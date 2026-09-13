/**
 * Pure MatchSession decision logic (SPEC.md §6, §8, §9, §15, §29; ADR-0138 for Bundle 2/3
 * evolution). Deliberately free of any Durable Object / Workers-runtime API so it is
 * unit-testable with plain Vitest — see `../test/state.test.ts`. `match-session-object.ts` is
 * the only caller; it owns all I/O (Durable Object storage, WebSocket broadcast) and defers
 * every decision to these functions.
 *
 * `MATCH_START` is classified alongside `PERIOD_START`/`PERIOD_END`/`MATCH_END` as one
 * existing period-transition concept (`src/lib/live-match/live-match-types.ts`'s
 * `LIVE_EVENT_TYPES_THAT_ARE_PERIOD_TRANSITIONS`) — exactly as state-establishing as the other
 * three.
 *
 * ADR-0138 (Bundle 3, DECISIONS.md D08/D09/D10) replaced the original Stage 3 catch-all
 * classification ("every event type not explicitly listed is append-safe by default") with the
 * exhaustive, closed classification below, and replaced the single whole-state
 * `baseVersion === meta.version` conflict gate for every state-sensitive operation with
 * domain-scoped revisions plus real semantic precondition evaluation against this session's own
 * accepted-event history — see `evaluateRecordEvent()`'s own doc comment for the full model and
 * its disclosed scope boundaries (most notably: lineup preconditions are session-relative, since
 * this object does not yet load the match's starting-lineup baseline — that is Bundle 5's
 * projection-baseline work).
 */

import type { ClockAnchor } from "../../../src/lib/live-match/realtime/realtime-messages";
import type { ConflictCode } from "../../../src/lib/live-match/realtime/protocol";

/**
 * ADR-0138 (Bundle 3), DECISIONS.md D09 — the exhaustive, closed set of known
 * `LiveMatchEventType` values (`prisma/schema.prisma`), kept as plain string literals (not an
 * import of the generated Prisma enum type) so this module keeps its zero-Prisma-dependency
 * guarantee (documented at the top of this file) — `RecordEventCommand.event` is untyped
 * `Record<string, unknown>` at the protocol level, so there is no type-level connection to
 * duplicate against in the first place.
 *
 * This replaces the previous catch-all classification (Stage 3's "every other event type is
 * append-safe by default"), which a direct audit found had already misclassified `SCORER_SET`/
 * `ASSIST_SET` as append-safe — DECISIONS.md D09 places them in the Annotation domain
 * (state-sensitive). `classifyDomain()`'s exhaustive switch below has a `never`-typed default
 * case: a new `LiveMatchEventType` enum value added without updating this list produces a
 * compile error here, and `isKnownLiveMatchEventType()` makes an unrecognized runtime string
 * fail closed (rejected as `invalid` in `evaluateRecordEvent`) rather than silently defaulting
 * to append-safe.
 */
export const KNOWN_LIVE_MATCH_EVENT_TYPES = [
  "MATCH_START",
  "PERIOD_START",
  "PERIOD_END",
  "MATCH_END",
  "CLOCK_ADJUSTMENT",
  "GOAL_FOR",
  "GOAL_AGAINST",
  "FAIR_PLAY_POSITIVE",
  "FAIR_PLAY_CONCERN",
  "MOMENT_MARKED",
  "ROTATION_OUT",
  "ROTATION_IN",
  "POSITIONS_CHANGED",
  "SCORER_SET",
  "ASSIST_SET",
  "EVENT_CORRECTED",
  "EVENT_REVERSED",
] as const;

export type KnownLiveMatchEventType = (typeof KNOWN_LIVE_MATCH_EVENT_TYPES)[number];

export function isKnownLiveMatchEventType(value: string): value is KnownLiveMatchEventType {
  return (KNOWN_LIVE_MATCH_EVENT_TYPES as readonly string[]).includes(value);
}

/** DECISIONS.md D08 — the domain an operation's semantic precondition/revision belongs to.
 * `"append-safe"` operations need neither. */
export type OperationDomain = "append-safe" | "clock" | "lineup" | "annotation";

/** DECISIONS.md D09's exact classification table. A `never`-typed default case makes an
 * unhandled `LiveMatchEventType` a compile error, not a silent default. */
export function classifyDomain(eventType: KnownLiveMatchEventType): OperationDomain {
  switch (eventType) {
    case "GOAL_FOR":
    case "GOAL_AGAINST":
    case "FAIR_PLAY_POSITIVE":
    case "FAIR_PLAY_CONCERN":
    case "MOMENT_MARKED":
      return "append-safe";
    case "MATCH_START":
    case "PERIOD_START":
    case "PERIOD_END":
    case "MATCH_END":
    case "CLOCK_ADJUSTMENT":
      return "clock";
    case "ROTATION_OUT":
    case "ROTATION_IN":
    case "POSITIONS_CHANGED":
      return "lineup";
    case "SCORER_SET":
    case "ASSIST_SET":
    case "EVENT_CORRECTED":
    case "EVENT_REVERSED":
      return "annotation";
    default: {
      const exhaustive: never = eventType;
      throw new Error(`Unclassified LiveMatchEventType: ${String(exhaustive)}`);
    }
  }
}

export type EventClassification = "append-safe" | "state-sensitive";

/** Kept for the handful of call sites/tests that only need the coarse append-safe/
 * state-sensitive split. An unrecognized string is treated as `"state-sensitive"` here — the
 * conservative, fail-closed choice for this narrow helper — but the real safety net is
 * `evaluateRecordEvent`'s own `isKnownLiveMatchEventType()` check, which rejects an unknown
 * type as `invalid` before classification is ever consulted for a real decision. */
export function classifyEventType(eventType: string): EventClassification {
  if (!isKnownLiveMatchEventType(eventType)) return "state-sensitive";
  return classifyDomain(eventType) === "append-safe" ? "append-safe" : "state-sensitive";
}

/** SPEC.md §15 "meta". `startedAt`/`expectedEndAt`/`lastActivityAt` (added for the finite
 * session-lifecycle expiry below) are optional so a `meta` row written before this field
 * existed still deserializes safely — `evaluateLifecycleExpiry` treats a missing `startedAt`/
 * `lastActivityAt` as "no reliable basis to judge expiry" and never expires that session
 * automatically, leaving it to the bounded-retry/manual-end paths instead. Every *new* session
 * (the `"initialize"` outcome below) always populates all three. */
export interface SessionMeta {
  matchId: string;
  sessionId: string;
  organisationId: string;
  version: number;
  clockAnchor: ClockAnchor;
  endedAt: number | null;
  endReason?: "MANUAL" | "AUTO_EXPIRED";
  startedAt?: number;
  /** Kickoff + expected match duration (ms epoch) from the issuing ticket, or `null` when the
   * issuing route couldn't resolve one (e.g. no shared duration source yet) — see
   * `evaluateLifecycleExpiry`. */
  expectedEndAt?: number | null;
  /** Last time an authenticated `"report"`-capability connection had an event *accepted*
   * (`evaluateRecordEvent`'s `"accepted"` outcome) — deliberately not connection presence
   * (SPEC.md's own guidance: a "Follow live" viewer's connect/disconnect must never affect a
   * reporting session's lifecycle). */
  lastActivityAt?: number;
  /** ADR-0138 (Bundle 3), DECISIONS.md D08 — domain revision counters, replacing the single
   * whole-state `version`-equality conflict check for state-sensitive operations. Only an
   * accepted operation in that domain increments its counter; an accepted operation in a
   * different domain (including any append-safe operation) never does. Optional so a `meta` row
   * written before Bundle 3 still deserializes safely; `revisionFor()` below treats a missing
   * counter as `0`. Every *new* session (the `"initialize"` outcome) always populates all three. */
  clockRevision?: number;
  lineupRevision?: number;
  annotationRevision?: number;
}

/** Reads a domain revision counter with the pre-Bundle-3-row-safe default of `0`. */
export function revisionFor(meta: SessionMeta, domain: "clock" | "lineup" | "annotation"): number {
  switch (domain) {
    case "clock":
      return meta.clockRevision ?? 0;
    case "lineup":
      return meta.lineupRevision ?? 0;
    case "annotation":
      return meta.annotationRevision ?? 0;
  }
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
 * never the original submitted fields.
 *
 * `"failed_exhausted"` (added alongside `evaluateRetry` below) is a *bounded-retry* terminal
 * state, distinct from `"failed_terminal"`'s *domain* terminal state: it means the outbox gave
 * up after its own retry ceiling without ever getting a definitive answer (e.g. a sustained
 * infrastructure failure returning a status that isn't the one true domain-terminal code), not
 * that the event is known-invalid. It deliberately does NOT count toward `endSession`'s
 * `pendingCount` block (`evaluateEndSession` below only counts `"pending"`) — an exhausted
 * event has already been safely persisted via the caller's own HTTP fallback path (see
 * `league-live-match-client.tsx`'s `createLeagueActions.recordEvent`), so this object's own
 * copy giving up must never deadlock a coach's ability to end their session. */
export interface AcceptedEventRecord {
  clientEventId: string;
  version: number;
  actorUserId: string;
  acceptedAt: number;
  eventType: string;
  eventFields?: Record<string, unknown>;
  persistenceStatus: "pending" | "persisted" | "failed_terminal" | "failed_exhausted";
  canonicalEventId?: string;
  retryCount: number;
  nextRetryAt?: number;
  /** Set on the first failed attempt for this event; drives `evaluateRetry`'s max-age check. */
  firstFailureAt?: number;
  lastFailureAt?: number;
  lastErrorStatus?: number;
  lastErrorCategory?: "terminal" | "retryable";
}

export function initialClockAnchor(now: number): ClockAnchor {
  return { period: "BEFORE", running: false, matchSecondsAtAnchor: 0, anchorServerTimeMs: now };
}

const PERIOD_TRANSITION_EVENT_TYPES: ReadonlySet<string> = new Set([
  "MATCH_START",
  "PERIOD_START",
  "PERIOD_END",
  "MATCH_END",
]);

/**
 * ADR-0133 H6c — keep the session `clockAnchor` current so a reconnecting client / Follow-Live
 * viewer gets a correct clock from the snapshot. Previously the anchor was set once to `BEFORE`
 * and never advanced. A non-transition event returns the anchor unchanged. `MATCH_START` /
 * `PERIOD_START` mean a playing period is now running; `PERIOD_END` / `MATCH_END` stop the clock.
 * `matchSeconds` is milliseconds since period start (ADR-0133 H3) — clamp a missing/negative
 * value to 0 rather than trust it.
 */
export function advanceClockAnchor(
  current: ClockAnchor,
  eventType: string,
  eventFields: Record<string, unknown> | undefined,
  acceptedAt: number,
): ClockAnchor {
  if (!PERIOD_TRANSITION_EVENT_TYPES.has(eventType)) return current;
  const period =
    typeof eventFields?.period === "string"
      ? (eventFields.period as ClockAnchor["period"])
      : current.period;
  const running = eventType === "MATCH_START" || eventType === "PERIOD_START";
  const matchSecondsAtAnchor =
    typeof eventFields?.matchSeconds === "number" && eventFields.matchSeconds >= 0
      ? eventFields.matchSeconds
      : 0;
  return { period, running, matchSecondsAtAnchor, anchorServerTimeMs: acceptedAt };
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
  /** See `SessionMeta.expectedEndAt`'s doc comment. */
  expectedEndAt?: number | null;
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
        startedAt: params.now,
        expectedEndAt: params.ticket.expectedEndAt ?? null,
        lastActivityAt: params.now,
        clockRevision: 0,
        lineupRevision: 0,
        annotationRevision: 0,
      },
    };
  }

  if (params.existingMeta.organisationId !== params.ticket.organisationId) {
    return { outcome: "session_mismatch" };
  }

  return { outcome: "attach" };
}

// ---------------------------------------------------------------------------------------
// semantic preconditions (ADR-0138, Bundle 3 — DECISIONS.md D08/D10)
// ---------------------------------------------------------------------------------------

export type PreconditionResult = { ok: true } | { ok: false; conflictCode: ConflictCode };

/**
 * The on-field player set derived purely from this session's own accepted-event history
 * (`ROTATION_OUT`/`ROTATION_IN`), excluding any event whose persistence is known to have
 * terminally failed (it will never exist in Neon, so it must not keep affecting this object's
 * own precondition checks going forward).
 *
 * `touchedPlayerIds` is tracked separately from `onFieldPlayerIds` because this object does not
 * yet load the match's starting-lineup baseline (that is Bundle 5's projection-baseline work) —
 * without it, a player never mentioned by any event in this session is genuinely *unknown*, not
 * provably on or off field. The precondition evaluators below treat "unknown" as permissive in
 * both directions (a never-touched player can be rotated either way) and only reject a
 * transition once this session's own history has explicitly recorded the player in the opposite
 * state. This is sufficient for the concrete conflict scenarios this program's own worked
 * examples describe (a player already rotated by another device *within the same session*, see
 * PROGRAMME.md's "Example that must conflict") but cannot detect a same-direction double-rotation
 * of a starting-lineup player who has never otherwise appeared in this session's event history —
 * a disclosed, deliberate scope boundary pending Bundle 5's baseline.
 */
export interface LineupSessionState {
  onFieldPlayerIds: ReadonlySet<string>;
  touchedPlayerIds: ReadonlySet<string>;
}

export function deriveLineupState(acceptedEvents: readonly AcceptedEventRecord[]): LineupSessionState {
  const onField = new Set<string>();
  const touched = new Set<string>();
  const ordered = [...acceptedEvents].sort((a, b) => a.version - b.version);
  for (const event of ordered) {
    if (event.persistenceStatus === "failed_terminal") continue;
    const playerId = typeof event.eventFields?.playerId === "string" ? event.eventFields.playerId : undefined;
    if (!playerId) continue;
    if (event.eventType === "ROTATION_OUT") {
      onField.delete(playerId);
      touched.add(playerId);
    } else if (event.eventType === "ROTATION_IN") {
      onField.add(playerId);
      touched.add(playerId);
    }
  }
  return { onFieldPlayerIds: onField, touchedPlayerIds: touched };
}

/** DECISIONS.md D10 lineup preconditions.
 *
 * `POSITIONS_CHANGED`'s real payload shape was confirmed during Bundle 5's projection work
 * (`live-match-client.tsx`'s own `handlePositionChangeSelectRole`/`handleAssistSelect`-adjacent
 * call sites and their component test): one event per moved player, `playerId` as the top-level
 * actor and `{ fromPosition, toPosition }` on `payload` — never a batched
 * `{ assignments: [...] }` array. The earlier defensive `assignments`-array check here was an
 * unverified Bundle 3 assumption that never actually matched a real payload and so never fired;
 * fixed to check the real shape now that it is confirmed. */
export function evaluateLineupPrecondition(
  eventType: KnownLiveMatchEventType,
  eventFields: Record<string, unknown> | undefined,
  lineupState: LineupSessionState,
): PreconditionResult {
  if (eventType === "ROTATION_OUT") {
    const playerId = typeof eventFields?.playerId === "string" ? eventFields.playerId : undefined;
    if (playerId && lineupState.touchedPlayerIds.has(playerId) && !lineupState.onFieldPlayerIds.has(playerId)) {
      return { ok: false, conflictCode: "PLAYER_ALREADY_OFF_FIELD" };
    }
    return { ok: true };
  }
  if (eventType === "ROTATION_IN") {
    const playerId = typeof eventFields?.playerId === "string" ? eventFields.playerId : undefined;
    if (playerId && lineupState.onFieldPlayerIds.has(playerId)) {
      return { ok: false, conflictCode: "PLAYER_ALREADY_ON_FIELD" };
    }
    return { ok: true };
  }
  if (eventType === "POSITIONS_CHANGED") {
    const playerId = typeof eventFields?.playerId === "string" ? eventFields.playerId : undefined;
    // A delayed position change for a player who has since been rotated off the field is stale
    // — the device captured "move player X" while offline, but X was substituted off before
    // this operation was finally applied. Mirrors ROTATION_OUT's own staleness check above.
    if (playerId && lineupState.touchedPlayerIds.has(playerId) && !lineupState.onFieldPlayerIds.has(playerId)) {
      return { ok: false, conflictCode: "POSITION_ASSIGNMENT_CHANGED" };
    }
    return { ok: true };
  }
  return { ok: true };
}

/** Bundle 5 (ADR-0138) — mirrors `src/lib/live-match/live-match-domain.ts`'s
 * `derivePositionChangeFromPayload` exactly, duplicated locally per this module's own
 * zero-Prisma/zero-main-app-runtime-dependency convention (see `PERIOD_ORDER` above for the
 * established precedent) — the Worker imports only *types* from `src/lib`, never runtime code. */
export function derivePositionChange(
  eventType: string,
  payload: unknown,
): { fromPosition: string | null; toPosition: string } | null {
  if (eventType !== "POSITIONS_CHANGED") return null;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const toPosition = record.toPosition;
  if (typeof toPosition !== "string" || toPosition.length === 0) return null;
  const fromPosition = typeof record.fromPosition === "string" ? record.fromPosition : null;
  return { fromPosition, toPosition };
}

/** Canonical period sequence (matches `src/lib/live-match/live-match-types.ts`'s
 * `MATCH_PERIOD_ORDER`, duplicated here as a plain literal array for this module's own
 * zero-Prisma-dependency guarantee — see this file's header). */
const PERIOD_ORDER = [
  "BEFORE",
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_FIRST_HALF",
  "EXTRA_HALF_TIME",
  "EXTRA_SECOND_HALF",
  "FULL_TIME",
] as const;

function periodIndex(period: string): number {
  return (PERIOD_ORDER as readonly string[]).indexOf(period);
}

/**
 * DECISIONS.md D10 clock preconditions, adapted to this repository's actual event-payload
 * convention: every period-transition event type (`MATCH_START`/`PERIOD_START`/`PERIOD_END`/
 * `MATCH_END`) carries `period` as the RESULTING period after the transition — confirmed
 * against `live-match-client.tsx`'s own period-advance call site and `advanceClockAnchor`'s
 * existing handling of the same field — not "the period being ended," as D10's abstract wording
 * in isolation might suggest. The protective intent (reject an illegal/backward transition; a
 * duplicate transition to the same resulting period is a harmless no-op, not a hard conflict) is
 * preserved under the real convention: forward-or-equal only, by `PERIOD_ORDER` index.
 * `CLOCK_ADJUSTMENT` never changes period, so it has no period-transition precondition here —
 * its own forward-only guarantee is enforced separately, on the persisted `LiveMatchSession`
 * clock (`src/lib/live-match/session-clock.ts`'s `isForwardClockTransition`), a distinct
 * mechanism from this session-local `clockAnchor` (reconciling the two is Bundle 5's "make clock
 * operation/materialized clock relationship explicit").
 */
export function evaluateClockPrecondition(
  eventType: KnownLiveMatchEventType,
  eventFields: Record<string, unknown> | undefined,
  currentPeriod: string,
): PreconditionResult {
  if (eventType === "CLOCK_ADJUSTMENT") return { ok: true };
  if (eventType !== "MATCH_START" && eventType !== "PERIOD_START" && eventType !== "PERIOD_END" && eventType !== "MATCH_END") {
    return { ok: true };
  }

  const requestedPeriod = typeof eventFields?.period === "string" ? eventFields.period : undefined;
  if (!requestedPeriod) return { ok: true }; // malformed payload — not this evaluator's concern

  if (eventType === "MATCH_START") {
    return currentPeriod === "BEFORE" ? { ok: true } : { ok: false, conflictCode: "ILLEGAL_PERIOD_TRANSITION" };
  }

  const currentIdx = periodIndex(currentPeriod);
  const requestedIdx = periodIndex(requestedPeriod);
  if (requestedIdx === -1 || currentIdx === -1 || requestedIdx < currentIdx) {
    return { ok: false, conflictCode: "ILLEGAL_PERIOD_TRANSITION" };
  }
  return { ok: true };
}

/**
 * DECISIONS.md D10 annotation preconditions. Resolves a target event by EITHER its
 * `clientEventId` or (once persisted) its `canonicalEventId` — the browser's existing "Undo"
 * flow (`live-match-client.tsx`'s `handleUndo`) can reference either depending on whether the
 * target event has synced yet, so both must resolve here too. `SCORER_SET`/`ASSIST_SET` reuse
 * the existing `correctsEventId` field to reference the goal they annotate
 * (CANONICAL_OPERATION_CONTRACT.md's own terminology note: "do not create a second parallel
 * concept merely to rename it") — a target-less `SCORER_SET`/`ASSIST_SET` (an older client, or
 * the payload genuinely carries none) has no target to validate and is accepted, matching
 * current behavior exactly.
 */
export function evaluateAnnotationPrecondition(
  eventType: KnownLiveMatchEventType,
  eventFields: Record<string, unknown> | undefined,
  acceptedEvents: readonly AcceptedEventRecord[],
): PreconditionResult {
  const targetId = typeof eventFields?.correctsEventId === "string" ? eventFields.correctsEventId : undefined;
  if (!targetId) return { ok: true };

  const active = acceptedEvents.filter((e) => e.persistenceStatus !== "failed_terminal");
  const target = active.find((e) => e.clientEventId === targetId || e.canonicalEventId === targetId);
  if (!target) {
    return { ok: false, conflictCode: "TARGET_EVENT_MISSING" };
  }

  if (eventType === "EVENT_REVERSED") {
    const alreadyReversed = active.some(
      (e) =>
        e.eventType === "EVENT_REVERSED" &&
        (e.eventFields?.correctsEventId === target.clientEventId || e.eventFields?.correctsEventId === target.canonicalEventId),
    );
    if (alreadyReversed) {
      return { ok: false, conflictCode: "TARGET_EVENT_ALREADY_REVERSED" };
    }
  }

  return { ok: true };
}

function evaluatePrecondition(
  domain: Exclude<OperationDomain, "append-safe">,
  eventType: KnownLiveMatchEventType,
  eventFields: Record<string, unknown> | undefined,
  meta: SessionMeta,
  acceptedEvents: readonly AcceptedEventRecord[],
): PreconditionResult {
  switch (domain) {
    case "clock":
      return evaluateClockPrecondition(eventType, eventFields, meta.clockAnchor.period);
    case "lineup":
      return evaluateLineupPrecondition(eventType, eventFields, deriveLineupState(acceptedEvents));
    case "annotation":
      return evaluateAnnotationPrecondition(eventType, eventFields, acceptedEvents);
  }
}

// ---------------------------------------------------------------------------------------
// recordEvent
// ---------------------------------------------------------------------------------------

export type RecordEventDecision =
  | { outcome: "session_ended" }
  | { outcome: "invalid" }
  | { outcome: "duplicate"; existing: AcceptedEventRecord }
  | { outcome: "conflict"; conflictCode: ConflictCode; currentVersion: number }
  | { outcome: "accepted"; record: AcceptedEventRecord; domain: OperationDomain };

/**
 * SPEC.md §8, §9, §20 steps 1–5; ADR-0138 Bundle 3 for the concurrency model itself. Pure
 * decision only — the caller is responsible for actually persisting `record` to Durable Object
 * storage and broadcasting `applyEvent`; this function has no side effects so every branch is
 * independently testable.
 *
 * DECISIONS.md D08's replacement of the single whole-state `baseVersion === meta.version` gate:
 * an append-safe operation is accepted unconditionally, regardless of `baseVersion` or of any
 * unrelated domain's revision — an accepted goal must never invalidate a pending rotation. A
 * state-sensitive operation is accepted or rejected purely by whether its *actual* semantic
 * precondition holds against this session's own current state (`evaluatePrecondition`) — never
 * by comparing `baseVersion` to `meta.version` (D10: "a stale revision is not automatically a
 * conflict"). `baseVersion` remains part of the wire command for backward compatibility and
 * client-side diagnostics but is no longer consulted for the accept/reject decision itself.
 */
export function evaluateRecordEvent(params: {
  meta: SessionMeta;
  existing: AcceptedEventRecord | undefined;
  acceptedEvents: readonly AcceptedEventRecord[];
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

  // ADR-0138 (Bundle 3) — an unrecognized event type is rejected outright rather than silently
  // defaulting to append-safe (the exact Stage-3 catch-all gap this bundle closes).
  if (typeof params.eventType !== "string" || !isKnownLiveMatchEventType(params.eventType)) {
    return { outcome: "invalid" };
  }

  const domain = classifyDomain(params.eventType);

  if (domain !== "append-safe") {
    const precondition = evaluatePrecondition(domain, params.eventType, params.eventFields, params.meta, params.acceptedEvents);
    if (!precondition.ok) {
      return { outcome: "conflict", conflictCode: precondition.conflictCode, currentVersion: params.meta.version };
    }
  }

  return {
    outcome: "accepted",
    domain,
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

/**
 * Root-cause hardening (2026-09 incident): `classifyPersistenceFailure` above only ever
 * classifies exactly one status (422) as terminal — every other failure, including a
 * structural/routing problem that will never resolve on its own (the incident: every call was
 * redirected 307 by a Vercel auth gate that didn't exempt this internal route), was retried
 * forever at the 60s backoff cap with no ceiling. `evaluateRetry` adds that ceiling: whichever
 * of a maximum attempt count or a maximum age is reached first stops the retry loop for good.
 * This is deliberately independent of *why* the failure is retryable — it is the backstop for
 * "retryable forever" being wrong regardless of the specific cause, current or future.
 */
export const MAX_RETRY_ATTEMPTS = 10;
export const MAX_RETRY_AGE_MS = 24 * 60 * 60 * 1000;

export type RetryDecision = { outcome: "retry"; nextRetryAt: number } | { outcome: "exhausted" };

export function evaluateRetry(params: { retryCount: number; firstFailureAt: number; now: number }): RetryDecision {
  const ageMs = params.now - params.firstFailureAt;
  if (params.retryCount >= MAX_RETRY_ATTEMPTS || ageMs >= MAX_RETRY_AGE_MS) {
    return { outcome: "exhausted" };
  }
  return { outcome: "retry", nextRetryAt: params.now + computeBackoffDelayMs(params.retryCount) };
}

// ---------------------------------------------------------------------------------------
// finite session lifecycle (2026-09 incident hardening)
// ---------------------------------------------------------------------------------------

/** Grace period after the expected match end (kickoff + duration) before lifecycle expiry is
 * even considered — covers stoppage time, a delayed kickoff the ticket's `expectedEndAt` can't
 * see, and ordinary reporting wrap-up. */
export const LIFECYCLE_GRACE_MS = 30 * 60 * 1000;
/** Deadline basis for a session whose ticket never carried an `expectedEndAt` (no shared
 * duration source yet — see `LiveMatchRealtimeTicket.expectedEndAt`'s doc comment) — measured
 * from session start, not kickoff, since kickoff itself is unknown here. */
export const LIFECYCLE_FALLBACK_CEILING_MS = 4 * 60 * 60 * 1000;
/** Once past the deadline, how long *reporting* must have been silent before treating the
 * session as abandoned. Deliberately independent of connection/WebSocket presence — a "Follow
 * live" viewer connecting or disconnecting must never affect this (SPEC.md; `lastActivityAt`
 * only advances on an accepted `recordEvent`, never on `authenticate`/`getSnapshot`). */
export const LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS = 15 * 60 * 1000;
/** How often to re-check once past the deadline but still seeing recent reporting activity
 * (e.g. a match legitimately running long) — avoids scheduling a lifecycle-check alarm more
 * often than this even though the object is not yet ready to decide. */
export const LIFECYCLE_RECHECK_INTERVAL_MS = 30 * 60 * 1000;

export type LifecycleDecision =
  | { outcome: "active"; nextCheckAt: number | null }
  | { outcome: "expire" };

/**
 * Decides whether an unended session should be auto-expired. Deliberately conservative: a
 * session created before `startedAt`/`lastActivityAt` existed (an already-running object at
 * deploy time) always reads `"active"` with no further check scheduled from here — there is no
 * reliable basis to judge it, and the bounded-retry ceiling above already guarantees its alarm
 * traffic (if any) is itself bounded, and a coach's own "End session" action always remains
 * available regardless. Auto-expiry only ever sets `SessionMeta.endedAt` (transport/session
 * bookkeeping) — it must never submit or finalize a post-match report; that stays a fact about
 * canonical Postgres state the browser/server-action layer owns, entirely untouched here.
 */
export function evaluateLifecycleExpiry(params: {
  startedAt: number | undefined;
  expectedEndAt: number | null | undefined;
  lastActivityAt: number | undefined;
  now: number;
}): LifecycleDecision {
  if (params.startedAt === undefined || params.lastActivityAt === undefined) {
    return { outcome: "active", nextCheckAt: null };
  }

  // Clamp: an implausible expectedEndAt (bad/stale ticket data, a match scheduled absurdly far
  // in the future — confirmed live via a CI regression where an E2E fixture's test-only match
  // date landed decades out, computing a `setAlarm()` time the real Cloudflare runtime rejected
  // and silently broke every authenticate() call) must never push the lifecycle deadline LATER
  // than our own safety ceiling. Trust expectedEndAt only when it's sooner than the fallback,
  // never later — every realistic match duration is well under this ceiling regardless.
  const fallbackDeadline = params.startedAt + LIFECYCLE_FALLBACK_CEILING_MS;
  const basisDeadline = params.expectedEndAt != null ? Math.min(params.expectedEndAt, fallbackDeadline) : fallbackDeadline;
  const deadline = basisDeadline + LIFECYCLE_GRACE_MS;
  if (params.now < deadline) {
    return { outcome: "active", nextCheckAt: deadline };
  }

  const inactivityMs = params.now - params.lastActivityAt;
  if (inactivityMs >= LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS) {
    return { outcome: "expire" };
  }
  return { outcome: "active", nextCheckAt: params.now + LIFECYCLE_RECHECK_INTERVAL_MS };
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
 * the top of this file, extends to not importing that type either).
 *
 * ADR-0138 (Bundle 2) adds `sequence`/`correctionType`/`correctsEventId` — the snapshot
 * endpoint already returns events ordered by persisted `sequence` (nulls last), so this array
 * arrives pre-sorted in true canonical order wherever a real sequence exists. */
export interface ReconcilableCanonicalEvent {
  clientEventId: string;
  id: string;
  eventType: string;
  createdAt: string;
  playerId?: string;
  secondaryPlayerId?: string;
  sequence?: number | null;
  correctionType?: string | null;
  correctsEventId?: string | null;
}

export interface ReconciliationResult {
  newRecords: AcceptedEventRecord[];
  finalVersion: number;
}

/**
 * SPEC.md §23 — events that reached Neon via the HTTP fallback path while this object either
 * didn't exist yet or was disconnected never went through `evaluateRecordEvent`, so they have
 * no local `AcceptedEventRecord`. `actorUserId` is left empty — reconciled events are already
 * canonical (their real authorship lives in Neon); this object never learns who wrote them
 * from the snapshot response alone, and nothing here needs to know.
 *
 * ADR-0138 (Bundle 2, "Reconcile Durable Object state from persisted sequence, never
 * regenerated local numbering" — DECISIONS.md D06): a discovered event that already carries a
 * real persisted `sequence` (it went through the coordinator and the internal persistence
 * path, e.g. this object lost its in-memory/storage state and is rebuilding from Neon) reuses
 * that exact sequence as its `version` — it is never renumbered. Only a genuinely
 * sequence-less event (the direct-HTTP path, ARR-0045, still possible until Bundle 4's
 * single-mutation-path cutover) is assigned a synthetic version by incrementing past the
 * highest version/sequence seen so far — a documented, transitional-only fallback
 * (`PROTOCOL_SCHEMA_MIGRATION.md` §4), never the normal case once Bundle 4 lands. `finalVersion`
 * is seeded from the higher of this object's own prior version and the highest persisted
 * sequence discovered here, so a fresh object (no prior local state at all) resumes at the
 * correct next sequence instead of colliding with rows Neon already has.
 */
export function evaluateReconciliation(params: {
  currentVersion: number;
  knownClientEventIds: ReadonlySet<string>;
  canonicalEvents: readonly ReconcilableCanonicalEvent[];
}): ReconciliationResult {
  const maxPersistedSequence = params.canonicalEvents.reduce(
    (max, event) => (typeof event.sequence === "number" ? Math.max(max, event.sequence) : max),
    0,
  );
  let version = Math.max(params.currentVersion, maxPersistedSequence);
  const newRecords: AcceptedEventRecord[] = [];

  for (const event of params.canonicalEvents) {
    if (params.knownClientEventIds.has(event.clientEventId)) continue;

    const assignedVersion = typeof event.sequence === "number" ? event.sequence : (version += 1);
    version = Math.max(version, assignedVersion);

    newRecords.push({
      clientEventId: event.clientEventId,
      version: assignedVersion,
      actorUserId: "",
      acceptedAt: new Date(event.createdAt).getTime(),
      eventType: event.eventType,
      eventFields: {
        eventType: event.eventType,
        ...(event.playerId != null ? { playerId: event.playerId } : {}),
        ...(event.secondaryPlayerId != null ? { secondaryPlayerId: event.secondaryPlayerId } : {}),
        ...(event.correctionType != null ? { correctionType: event.correctionType } : {}),
        ...(event.correctsEventId != null ? { correctsEventId: event.correctsEventId } : {}),
      },
      persistenceStatus: "persisted",
      canonicalEventId: event.id,
      retryCount: 0,
    });
  }

  return { newRecords, finalVersion: version };
}
