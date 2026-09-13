/**
 * Business payload types for the realtime protocol (SPEC.md §5, §10, §25). Kept separate
 * from `protocol.ts`'s generic envelope per that file's own header comment.
 *
 * Two of these types are fully specified by SPEC.md at the field level (`ClockAnchor` §10,
 * `MatchSessionSnapshot` §25) and are reproduced exactly. The rest are named by SPEC.md §5
 * without exhaustive field lists — SPEC.md's own sequencing (§40 Stage 1: "No production
 * behaviour changes yet") means their exact shape is intentionally deferred to the stage
 * that actually wires each one to real data (Stage 3 for auth/snapshot RPCs, Stage 4 for
 * `CanonicalLiveEvent`, Stage 5 for the event-recording command/callback pair). Do not treat
 * the minimal shapes below as final — extend them in the stage that needs the extra fields,
 * and update this comment.
 */

import type { MatchPeriod } from "../live-match-types";

/** SPEC.md §10 — anchor-based clock state. Fully specified. */
export interface ClockAnchor {
  period: MatchPeriod;
  running: boolean;
  matchSecondsAtAnchor: number;
  anchorServerTimeMs: number;
}

/** SPEC.md §25 — canonical event shape as reconstructed from Neon for realtime purposes.
 * Extended in Stage 5 to carry player context for live event display: playerId identifies
 * who the event is about (scorer, rotated-out player, etc.), secondaryPlayerId identifies
 * the secondary actor (assist, rotated-in player). Both are optional — some event types
 * (FAIR_PLAY_POSITIVE, FAIR_PLAY_CONCERN) may not have either.
 *
 * Extended further to carry period and matchSeconds for timestamped event display in both
 * Live Reporting and Follow Live surfaces (ADR-0112). These mirror LiveEventSummary's
 * period/matchSeconds fields and are populated from the event submission's original fields
 * when available. Events originating from reconciliation (Stage 6) may lack these fields.
 *
 * ADR-0138 (Bundle 2, "canonical wire event becomes replay-complete") extends this further
 * with `sequence` and complete correction metadata, so a consumer can replay exact observable
 * truth without a further database lookup. All four new fields are additive/optional — an
 * older client that doesn't know about them simply ignores them, matching the exact rollout
 * pattern ADR-0112 already established for `period`/`matchSeconds`. `sequence` is the
 * authoritative replay order (never `createdAt`) once present; it is only absent for a row
 * written via the direct-HTTP path that bypassed the coordinator entirely (ARR-0045, active
 * until Bundle 4's single-mutation-path cutover) or for an older row predating this migration. */
export interface CanonicalLiveEvent {
  id: string;
  clientEventId: string;
  eventType: string;
  createdAt: string;
  playerId?: string;
  secondaryPlayerId?: string;
  /** Match period when the event was recorded (e.g. FIRST_HALF, SECOND_HALF). Null for
   *  period-transition events and reconciled events that lack this context. */
  period?: MatchPeriod | null;
  /** Elapsed match clock time in milliseconds when the event was recorded. Null for
   *  events submitted without a clock position and for reconciled events. */
  matchSeconds?: number | null;
  /** Canonical per-session acceptance order (ADR-0138 D06). Authoritative replay order —
   * never sort by `createdAt` when this is present. Absent for a pre-migration row or one
   * written via the direct-HTTP path (ARR-0045). */
  sequence?: number | null;
  /** `"CORRECTION"` when this event amends another; `"REVERSAL"` when this event reverses
   * another. Null/absent for an ordinary, uncorrected event. */
  correctionType?: "CORRECTION" | "REVERSAL" | null;
  /** For a CORRECTION/REVERSAL event: the id of the event it targets. Null/absent otherwise.
   * A projection must resolve this id to determine active/superseded/reversed state — never
   * add the correction event's own id to an exclusion set (ARR-0047). */
  correctsEventId?: string | null;
  /** Diagnostic-only local capture wall-clock time from the originating device (ms epoch).
   * Never an ordering authority (ADR-0138 D07). */
  capturedAtClientMs?: number | null;
}

/** SPEC.md §25 — the full active-session snapshot sent on attach/reconnect. Fully specified
 * at the structural level; `events`/`pendingClientEventIds` element types are Stage 4's.
 *
 * ADR-0138 (Bundle 2) widens `protocolVersion` to `1 | 2` and adds `lastSequence`/`revisions` —
 * purely additive, an older client that only understands `1` and ignores unknown fields is
 * unaffected (matching ADR-0112's own established migration pattern). `lastSequence` is the
 * highest canonical sequence this session has accepted (`events` is already sorted by
 * `sequence` once Bundle 2 lands end-to-end). `revisions` (Bundle 3) are real classification-
 * based counters: only an accepted operation in a given domain increments that domain's
 * counter, so an accepted goal (append-safe) never advances any of them — see
 * `workers/live-match/src/state.ts`'s `evaluateRecordEvent`/`classifyDomain` for the model. */
export interface MatchSessionSnapshot {
  protocolVersion: 1 | 2;
  version: number;
  session: {
    sessionId: string;
    matchId: string;
    status: "ACTIVE" | "ENDED";
  };
  clock: ClockAnchor;
  events: CanonicalLiveEvent[];
  persistence: {
    pendingClientEventIds: string[];
  };
  presence: {
    connectedCount: number;
  };
  /** Highest canonical sequence accepted for this session so far. 0 when no event carrying a
   * real sequence has been accepted yet (e.g. before Bundle 4's cutover, or before this
   * session's first event). */
  lastSequence?: number;
  /** Domain revision counters (ADR-0138 D08). Placeholder until Bundle 3 wires real
   * classification-based increments — always `{ clock: 0, lineup: 0, annotation: 0 }` today. */
  revisions?: { clock: number; lineup: number; annotation: number };
}

/** SPEC.md §11 — ticket payload issued by `/api/live-match/[matchId]/realtime-ticket`
 * (Stage 2). Reproduced here so the browser client and Worker share one shape; the ticket
 * itself travels as a signed/encoded string, not this raw object, over the wire. */
export interface LiveMatchRealtimeTicket {
  type: "live-match-realtime";
  jti: string;
  userId: string;
  organisationId: string;
  matchId: string;
  sessionId: string;
  capabilities: string[];
  iat: number;
  exp: number;
  /** Kickoff + expected match duration (ms epoch), when the issuing route could resolve it —
   * used only for the Durable Object's own finite-lifecycle expiry (never for anything
   * football-domain-facing). `null`/absent when unresolvable (e.g. an Event match, which has no
   * shared duration-resolution wired here yet); the object falls back to inactivity-only
   * expiry in that case. See `workers/live-match/src/state.ts`'s `evaluateLifecycleExpiry`. */
  expectedEndAt?: number | null;
}

/**
 * SPEC.md §5.1 `authenticate` params — minimal for Stage 1. The Worker verifies the ticket
 * (Stage 3); the browser only needs to send it.
 */
export interface AuthenticateInput {
  ticket: string;
  clientId: string;
}

export interface AttachResult {
  authenticated: true;
  connectionId: string;
}

/**
 * SPEC.md §5.1 `recordEvent` — minimal for Stage 1. `baseVersion` implements SPEC.md §9's
 * optimistic-concurrency check; `event` carries whatever the existing `LiveEventInput` shape
 * needs, deferred to Stage 4 (`recordEventForActor`) rather than duplicated here now.
 *
 * ADR-0138 (Bundle 2) adds two optional diagnostic-only fields, carried through to the
 * persisted canonical row (`clientCapturedAt`/`originClientId`) — neither is an ordering or
 * conflict authority (D07). Replacing `baseVersion` with domain revisions/preconditions is
 * Bundle 3 scope, not this change.
 */
export interface RecordEventCommand {
  clientEventId: string;
  baseVersion: number;
  event: Record<string, unknown>;
  /** Local capture wall-clock time (ms epoch) from the originating device, if known. */
  clientCapturedAtMs?: number;
  /** Originating client identifier, for diagnostics only. */
  originClientId?: string;
}

export interface RecordEventResult {
  version: number;
  /** Stage 6 — `"failed_terminal"` is possible here (not just via the later
   * `eventPersistenceChanged` callback) because the first persistence attempt happens
   * synchronously within the same RPC call (Stage 4); a domain-validation failure is known
   * immediately, not just after a later retry. */
  persistenceStatus: "pending" | "persisted" | "failed_terminal";
}

/** SPEC.md §5.1 `syncPending` — minimal for Stage 1. */
export interface SyncPendingCommand {
  clientEventIds: string[];
}

export interface SyncPendingResult {
  accepted: string[];
}

/** SPEC.md §5.1 `endSession` — minimal for Stage 1; state-sensitive per SPEC.md §9.2. */
export interface EndSessionCommand {
  baseVersion: number;
}

export interface EndSessionResult {
  ended: true;
}

/** SPEC.md §5.2 — every server→client callback returns a `ClientAck` (SPEC.md §5.2's own
 * wording: "The browser returns a `result`"). Minimal shape until a stage needs more. */
export interface ClientAck {
  acknowledged: true;
}

export interface ApplyEventCallback {
  version: number;
  event: CanonicalLiveEvent;
}

export interface PersistenceChangedCallback {
  clientEventId: string;
  /** Stage 6 hardening — `"failed_exhausted"` means the persistence outbox gave up after its
   * bounded retry ceiling (attempt count or age, `workers/live-match/src/state.ts`'s
   * `evaluateRetry`) without ever getting a definitive terminal/success answer from the
   * internal API (e.g. a sustained infrastructure failure). ADR-0138 (Bundle 4) — after the
   * single-mutation-path cutover, there is no independent HTTP write to fall back on: the
   * event remains in the browser's local outbox, unsynchronized, until the coordinator
   * recovers and the next reconnect (`syncUnsyncedEvents`) retries it through this same
   * `recordEvent` path. This status is therefore operator-significant on its own — a growing
   * count of exhausted events means real coach-recorded actions are not reaching Neon. */
  persistenceStatus: "pending" | "persisted" | "failed_terminal" | "failed_exhausted";
}

export interface PresenceChangedCallback {
  connectedCount: number;
}

export interface SessionEndedCallback {
  version: number;
  /** `"MANUAL"` (the coach's own "End session" action reached this object's endSession RPC) or
   * `"AUTO_EXPIRED"` (the Durable Object's own finite-lifecycle expiry closed a session nobody
   * explicitly ended — see `evaluateLifecycleExpiry`). Absent on older stored sessions ended
   * before this field existed. Never triggers post-match report submission — see
   * `match-session-object.ts`'s alarm() doc comment. */
  reason?: "MANUAL" | "AUTO_EXPIRED";
}

export interface ForceResyncCallback {
  reason: string;
}

/**
 * SPEC.md §17-19, Stage 4 — payload the Durable Object signs and sends to the internal
 * persistence endpoint (`POST /api/internal/live-match/events`). Carries the actor identity
 * established when the connection's ticket was verified (never re-derived from anything the
 * browser could influence afterward) plus the event fields `recordEventForActor` needs.
 * Deliberately mirrors `LiveEventInput` field-for-field rather than importing it — that type
 * lives in the main app's domain layer (`src/lib/live-match/live-match-types.ts`), which this
 * Worker-shared module must not depend on transitively.
 */
export interface InternalPersistEventRequest {
  matchId: string;
  sessionId: string;
  organisationId: string;
  userId: string;
  clientEventId: string;
  eventType: string;
  period?: MatchPeriod;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  correctionType?: string;
  correctsEventId?: string;
  /** SPEC.md §18 "propagate requestId/rpcId for tracing" — the originating browser RPC call's
   * id, so one action can be correlated across both runtimes (SPEC.md §32). */
  rpcId: string;
  /** ADR-0138 (Bundle 2) — the coordinator-assigned canonical sequence for this operation
   * (the Durable Object's own monotonic per-session counter, already assigned in
   * `evaluateRecordEvent`/`AcceptedEventRecord.version` before this request is ever sent).
   * Required: this endpoint is only ever called by the coordinator, which always has one.
   * `recordEventForActor` persists it as-is — it must never be reassigned/renumbered by the
   * persistence layer. */
  sequence: number;
  /** The coordinator's own acceptance wall-clock time (ms epoch) — distinct from Neon's own
   * insert time, which can lag under retry. Required for the same reason as `sequence`. */
  acceptedAtMs: number;
  /** Diagnostic-only fields threaded through from `RecordEventCommand`, if the browser
   * supplied them. Never an ordering or conflict authority (ADR-0138 D07). */
  clientCapturedAtMs?: number;
  originClientId?: string;
}

/** SPEC.md §17 — response shape for both internal endpoints' event data: the POST endpoint
 * returns one on successful/deduplicated persistence, the GET snapshot endpoint returns an
 * array of them. Identical to `CanonicalLiveEvent` — no separate type needed. */
export type InternalPersistEventResponse = CanonicalLiveEvent;

/** SPEC.md §17, §23 — response shape for `GET /api/internal/live-match/snapshot`, consumed by
 * Stage 6's reconciliation (the Durable Object discovering HTTP-fallback-written events it
 * never saw). Defined now since the endpoint itself is Stage 4 scope. */
export interface InternalSnapshotResponse {
  session: {
    sessionId: string;
    matchId: string;
    status: "ACTIVE" | "ENDED";
  };
  /** Ordered by persisted `sequence` (nulls last, then `createdAt`/`id` as a deterministic
   * tie-breaker for rows with no sequence — ADR-0138 Bundle 2). Never re-sort this by
   * `createdAt` in a consumer. */
  events: CanonicalLiveEvent[];
  /** Highest persisted `sequence` among `events`, or 0 when none carry one yet. */
  lastSequence: number;
}
