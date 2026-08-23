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

/** SPEC.md §15 "accepted_events" row. `persistenceStatus` transitions "pending" ->
 * "persisted" (Stage 4, synchronous first attempt, or Stage 6's alarm retry) or "pending" ->
 * "failed_terminal" (Stage 6 — a domain-validation failure that will never succeed no matter
 * how many times it's retried). `nextRetryAt` is undefined until the first attempt fails;
 * Stage 6's alarm sweep (`selectDueRetries`) only ever considers events that already have one
 * (a freshly-accepted event always gets its first attempt synchronously in
 * `handleRecordEvent`, never via the alarm). `eventType` is needed to reconstruct a
 * `CanonicalLiveEvent` for `handleGetSnapshot` (Stage 6) without a second Neon round-trip.
 * `eventFields` is the rest of the browser's original `RecordEventCommand.event` payload
 * (period, matchSeconds, playerId, secondaryPlayerId, payload, correctionType,
 * correctsEventId) — stored so `alarm()`'s retry can resend the *exact* original persistence
 * request, not a stripped-down eventType-only one. Optional because reconciled records
 * (`evaluateReconciliation`) are already `"persisted"` and never need to be replayed — they
 * came from the internal snapshot endpoint, which only returns canonical id/type/timestamp,
 * never the original submitted fields. */
export interface AcceptedEventRecord {
  clientEventId: string;
  version: number;
  actorUserId: string;
  acceptedAt: number;
  eventType: string;
  eventFields?: Record<string, unknown>;
  persistenceStatus: "pending" | "persisted" | "failed_terminal";
  canonicalEventId?: string;
  retryCount: number;
  nextRetryAt?: number;
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
  eventFields?: Record<string, unknown>;
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
      eventType: params.eventType,
      eventFields: params.eventFields,
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

// ---------------------------------------------------------------------------------------
// persistence outbox: retry classification, backoff, alarm scheduling (SPEC.md §21, Stage 6)
// ---------------------------------------------------------------------------------------

/**
 * SPEC.md §21 — a domain-validation failure (session not found, session not active,
 * session/match/org mismatch, invalid event) will never succeed no matter how many times
 * it's retried; only a genuinely transient failure (network error, Vercel/Neon temporarily
 * unavailable, or a transient signing failure) is worth retrying. The internal persistence
 * route (`/api/internal/live-match/events`) returns exactly 422 for a known
 * `LiveMatchDomainError` and 503 for anything unexpected (`live-match-event-store.ts`) —
 * `status` here is `PersistEventError.status` (`undefined` for a network failure that never
 * got an HTTP response at all, which is retryable by definition).
 *
 * Only 422 is treated as terminal — matching exactly what the route documents, not a broader
 * "any 4xx" heuristic. In particular 401 (HMAC verification failure — `verifyInternalRequest`,
 * `internal-auth.ts`) must stay retryable: it can result from a momentary clock-skew edge case
 * against the 60-second timestamp tolerance, or a secret briefly out of sync during rotation —
 * neither means *this event's data* is invalid, only that *this specific signed request*
 * wasn't verified. A fresh retry re-signs with a newly-computed timestamp and would very
 * plausibly succeed once whatever caused the 401 has passed. Treating 401 as terminal would
 * permanently give up on an event during exactly the kind of transient infrastructure hiccup
 * retries exist to survive, and would broadcast a misleading permanent-failure signal to
 * connected clients for an event that a later attempt (or the browser's own HTTP fallback,
 * which is never subject to this same signing) might persist successfully.
 */
export function classifyPersistenceFailure(status: number | undefined): "terminal" | "retryable" {
  if (status === 422) return "terminal";
  return "retryable";
}

/** SPEC.md §21 "exponential backoff; capped retry delay." `retryCount` is the number of
 * *retry* attempts already made (the initial synchronous attempt in `handleRecordEvent` is
 * attempt zero, not a retry) — `computeBackoffDelayMs(0)` is the delay before the *first*
 * alarm-driven retry. Base and cap are implementation choices SPEC.md leaves unspecified
 * ("such as" language only): 1s base, doubling, capped at 60s, matching the same order of
 * magnitude as `RealtimeMatchClient`'s own reconnect backoff (Stage 1, capped at 30s) without
 * being identical — this is a distinct concern (canonical persistence retry, not WebSocket
 * reconnect) and coupling the two constants would be a coincidence, not a real relationship. */
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 60_000;

export function computeBackoffDelayMs(retryCount: number): number {
  const delay = RETRY_BASE_MS * 2 ** retryCount;
  return Math.min(delay, RETRY_CAP_MS);
}

/** Which currently-pending events are due for a retry attempt right now. An event with no
 * `nextRetryAt` yet has never failed (its only attempt so far was the synchronous one in
 * `handleRecordEvent`, which either succeeded or is still in flight) — the alarm sweep never
 * originates a first attempt, only retries ones that have already failed at least once. */
export function selectDueRetries(
  events: readonly AcceptedEventRecord[],
  now: number,
): AcceptedEventRecord[] {
  return events.filter(
    (event) =>
      event.persistenceStatus === "pending" &&
      event.nextRetryAt !== undefined &&
      event.nextRetryAt <= now,
  );
}

/** The single Durable Object alarm slot's next firing time — the minimum `nextRetryAt`
 * across every still-pending event, or `null` when nothing is waiting on a retry (in which
 * case the caller should clear any previously-scheduled alarm rather than let it fire and
 * find nothing to do — SPEC.md §21 "do not wake the object every second"). */
export function nextAlarmTime(events: readonly AcceptedEventRecord[]): number | null {
  const candidates = events
    .filter((event) => event.persistenceStatus === "pending" && event.nextRetryAt !== undefined)
    .map((event) => event.nextRetryAt as number);
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

// ---------------------------------------------------------------------------------------
// reconciliation after HTTP fallback (SPEC.md §23, Stage 6)
// ---------------------------------------------------------------------------------------

/** One canonical event as returned by the internal snapshot endpoint
 * (`InternalSnapshotResponse.events`, shared type lives in `realtime-messages.ts` — kept as a
 * narrower local shape here so this module's zero-Prisma-dependency guarantee, documented at
 * the top of this file, extends to not importing that type either). */
export interface ReconcilableCanonicalEvent {
  clientEventId: string;
  id: string;
  eventType: string;
  createdAt: string;
}

export interface ReconciliationResult {
  newRecords: AcceptedEventRecord[];
  finalVersion: number;
}

/**
 * SPEC.md §23 — events that reached Neon via the HTTP fallback path while this object either
 * didn't exist yet or was disconnected never went through `evaluateRecordEvent`, so they have
 * no realtime version and no local `AcceptedEventRecord`. This assigns each one a new
 * realtime version (in the snapshot endpoint's already-deterministic order, SPEC.md §24) and
 * an idempotency mapping, so a later realtime `recordEvent` retry for the same
 * `clientEventId` (e.g. from a client that also tried the realtime path before falling back
 * to HTTP) is still correctly deduped. `actorUserId` is left empty — reconciled events are
 * already canonical (their real authorship lives in Neon); this object never learns who wrote
 * them from the snapshot response alone, and nothing here needs to know (SPEC.md §23:
 * realtime version is coordination metadata, not business event sequence).
 */
export function evaluateReconciliation(params: {
  currentVersion: number;
  knownClientEventIds: ReadonlySet<string>;
  canonicalEvents: readonly ReconcilableCanonicalEvent[];
}): ReconciliationResult {
  let version = params.currentVersion;
  const newRecords: AcceptedEventRecord[] = [];

  for (const event of params.canonicalEvents) {
    if (params.knownClientEventIds.has(event.clientEventId)) continue;
    version += 1;
    newRecords.push({
      clientEventId: event.clientEventId,
      version,
      actorUserId: "",
      acceptedAt: new Date(event.createdAt).getTime(),
      eventType: event.eventType,
      persistenceStatus: "persisted",
      canonicalEventId: event.id,
      retryCount: 0,
    });
  }

  return { newRecords, finalVersion: version };
}
