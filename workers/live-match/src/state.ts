/**
 * Pure MatchSession decision logic (SPEC.md §6, §8, §9, §15, §29). Deliberately free of any
 * Durable Object / Workers-runtime API so it is unit-testable with plain Vitest — see
 * `../test/state.test.ts`. `match-session-object.ts` is the only caller; it owns all I/O
 * (Durable Object storage, WebSocket broadcast) and defers every decision to these functions.
 *
 * SPEC.md ambiguity resolved here: §9 classifies *event types*, not RPC methods, into
 * append-safe vs. state-sensitive, and gives examples rather than an exhaustive list ("other
 * genuinely additive observations" for append-safe). This module maps §9.2's exact examples
 * onto the existing `LiveMatchEventType` Prisma enum values (`prisma/schema.prisma`) and
 * treats every other event type as append-safe by default, matching §9.1's "other genuinely
 * additive observations" catch-all. `MATCH_START` is treated as state-sensitive even though
 * §9.2's list only names "period start" — it is grouped with `PERIOD_START`/`PERIOD_END`/
 * `MATCH_END` as one existing period-transition concept in
 * `src/lib/live-match/live-match-types.ts`'s `LIVE_EVENT_TYPES_THAT_ARE_PERIOD_TRANSITIONS`,
 * and is exactly as state-establishing as the events §9.2 does name.
 */

import type { ClockAnchor } from "../../../src/lib/live-match/realtime/realtime-messages";

/** SPEC.md §9.2, mapped to `prisma/schema.prisma`'s `LiveMatchEventType` enum values. Kept
 * as plain string literals (not an import of the generated Prisma enum type) so this module
 * has zero dependency on Prisma client generation succeeding in the Worker's separate build —
 * `RecordEventCommand.event` is untyped `Record<string, unknown>` at the protocol level
 * (Stage 1), so there is no type-level connection to duplicate against in the first place. */
export const STATE_SENSITIVE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "MATCH_START",
  "PERIOD_START",
  "PERIOD_END",
  "MATCH_END",
  "CLOCK_ADJUSTMENT",
  "ROTATION_OUT",
  "ROTATION_IN",
  "POSITIONS_CHANGED",
  "EVENT_CORRECTED",
  "EVENT_REVERSED",
]);

export type EventClassification = "append-safe" | "state-sensitive";

export function classifyEventType(eventType: string): EventClassification {
  return STATE_SENSITIVE_EVENT_TYPES.has(eventType) ? "state-sensitive" : "append-safe";
}

/** SPEC.md §15 "meta". */
export interface SessionMeta {
  matchId: string;
  sessionId: string;
  organisationId: string;
  version: number;
  clockAnchor: ClockAnchor;
  endedAt: number | null;
}

/** SPEC.md §15 "accepted_events" row. `persistenceStatus` stays `"pending"` forever in
 * Stage 3 — there is no persistence path yet (SPEC.md §40 Stage 3: "No event persistence
 * migration yet"); Stage 4 is what ever transitions this to `"persisted"`/`"failed_terminal"`. */
export interface AcceptedEventRecord {
  clientEventId: string;
  version: number;
  actorUserId: string;
  acceptedAt: number;
  persistenceStatus: "pending" | "persisted" | "failed_terminal";
  canonicalEventId?: string;
  retryCount: number;
}

export function initialClockAnchor(now: number): ClockAnchor {
  return { period: "BEFORE", running: false, matchSecondsAtAnchor: 0, anchorServerTimeMs: now };
}

// ---------------------------------------------------------------------------------------
// capability enforcement ("Follow live" read-only viewers)
// ---------------------------------------------------------------------------------------

/**
 * A ticket's `capabilities` (SPEC.md §11) is the only thing distinguishing a reporting
 * coach's connection from a read-only "Follow live" viewer's — the ticket is issued by
 * `/api/live-match/[matchId]/realtime-ticket` with `["report"]` or `["view"]` depending on
 * the caller's group-level role, and the Durable Object must not trust anything else about
 * the connection to decide whether a mutation is allowed. `authenticate`/`getSnapshot`/
 * `syncPending` are readable by any authenticated connection regardless of capability — only
 * `recordEvent`/`endSession` require `"report"`.
 */
export function hasReportCapability(capabilities: readonly string[]): boolean {
  return capabilities.includes("report");
}

// ---------------------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------------------

export interface AuthenticateTicketClaims {
  matchId: string;
  sessionId: string;
  organisationId: string;
}

export type AuthenticateDecision =
  | { outcome: "initialize"; meta: SessionMeta }
  | { outcome: "attach" }
  | { outcome: "session_mismatch" }
  | { outcome: "match_mismatch" };

/**
 * Decides what authenticating a connection should do to the object's `meta`. Two cases
 * create fresh meta: this object has never been authenticated into before, or the previous
 * session for this match already ended and a *new* live session (different `sessionId`) is
 * now authenticating — re-arming the actor rather than permanently wedging it to a session
 * that will never authenticate again. An in-progress session's `sessionId`/`organisationId`
 * must otherwise match exactly (SESSION_MISMATCH, SPEC.md §5.1) — ticket claims are
 * server-issued and trusted (SPEC.md §11), but must still agree with this object's own
 * established identity, which a stale/wrong ticket would not.
 */
export function evaluateAuthenticate(params: {
  routedMatchId: string;
  ticket: AuthenticateTicketClaims;
  existingMeta: SessionMeta | null;
  now: number;
}): AuthenticateDecision {
  if (params.ticket.matchId !== params.routedMatchId) {
    return { outcome: "match_mismatch" };
  }

  if (!params.existingMeta || params.existingMeta.sessionId !== params.ticket.sessionId) {
    if (params.existingMeta && params.existingMeta.endedAt === null) {
      return { outcome: "session_mismatch" };
    }
    return {
      outcome: "initialize",
      meta: {
        matchId: params.routedMatchId,
        sessionId: params.ticket.sessionId,
        organisationId: params.ticket.organisationId,
        version: 0,
        clockAnchor: initialClockAnchor(params.now),
        endedAt: null,
      },
    };
  }

  if (params.existingMeta.organisationId !== params.ticket.organisationId) {
    return { outcome: "session_mismatch" };
  }

  return { outcome: "attach" };
}

// ---------------------------------------------------------------------------------------
// recordEvent
// ---------------------------------------------------------------------------------------

export type RecordEventDecision =
  | { outcome: "session_ended" }
  | { outcome: "invalid" }
  | { outcome: "duplicate"; existing: AcceptedEventRecord }
  | { outcome: "stale_state"; currentVersion: number }
  | { outcome: "accepted"; record: AcceptedEventRecord };

/**
 * SPEC.md §8, §9, §20 steps 1–5. Pure decision only — the caller is responsible for actually
 * persisting `record` to Durable Object storage and broadcasting `applyEvent`; this function
 * has no side effects so every branch is independently testable.
 */
export function evaluateRecordEvent(params: {
  meta: SessionMeta;
  existing: AcceptedEventRecord | undefined;
  clientEventId: string;
  baseVersion: number;
  eventType: unknown;
  actorUserId: string;
  now: number;
}): RecordEventDecision {
  if (params.meta.endedAt !== null) {
    return { outcome: "session_ended" };
  }

  if (params.existing) {
    // SPEC.md §8 — the same clientEventId submitted again must not create a second
    // accepted event or advance the version a second time.
    return { outcome: "duplicate", existing: params.existing };
  }

  if (typeof params.eventType !== "string" || params.eventType.length === 0) {
    return { outcome: "invalid" };
  }

  if (classifyEventType(params.eventType) === "state-sensitive" && params.baseVersion !== params.meta.version) {
    return { outcome: "stale_state", currentVersion: params.meta.version };
  }

  return {
    outcome: "accepted",
    record: {
      clientEventId: params.clientEventId,
      version: params.meta.version + 1,
      actorUserId: params.actorUserId,
      acceptedAt: params.now,
      persistenceStatus: "pending",
      retryCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------------------
// syncPending
// ---------------------------------------------------------------------------------------

/** SPEC.md §5.1 `syncPending` — which of the browser's locally-unsynced `clientEventId`s
 * has this object already accepted (regardless of persistence status)? Used after reconnect
 * so the browser doesn't resubmit events the Durable Object already has. */
export function evaluateSyncPending(
  clientEventIds: readonly string[],
  accepted: ReadonlyMap<string, AcceptedEventRecord>,
): string[] {
  return clientEventIds.filter((id) => accepted.has(id));
}

// ---------------------------------------------------------------------------------------
// endSession
// ---------------------------------------------------------------------------------------

export type EndSessionDecision =
  | { outcome: "already_ended" }
  | { outcome: "stale_state"; currentVersion: number }
  | { outcome: "pending_persistence"; pendingCount: number }
  | { outcome: "ended" };

/**
 * SPEC.md §9.2, §29. `endSession` is itself always state-sensitive. Pending non-persisted
 * events block ending (§29: "do not silently end and clear ... while accepted events are
 * waiting to reach Neon") — in Stage 3 this means a session with any recorded event can
 * never actually end yet, since nothing transitions `persistenceStatus` away from
 * `"pending"` until Stage 4 exists. That is an intentional, documented Stage 3 limitation,
 * not a bug: ending is meaningful again once Stage 4's persistence path lands.
 */
export function evaluateEndSession(params: {
  meta: SessionMeta;
  baseVersion: number;
  pendingCount: number;
}): EndSessionDecision {
  if (params.meta.endedAt !== null) {
    return { outcome: "already_ended" };
  }
  if (params.baseVersion !== params.meta.version) {
    return { outcome: "stale_state", currentVersion: params.meta.version };
  }
  if (params.pendingCount > 0) {
    return { outcome: "pending_persistence", pendingCount: params.pendingCount };
  }
  return { outcome: "ended" };
}
