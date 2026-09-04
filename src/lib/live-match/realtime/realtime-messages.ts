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
 * when available. Events originating from reconciliation (Stage 6) may lack these fields. */
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
}

/** SPEC.md §25 — the full active-session snapshot sent on attach/reconnect. Fully specified
 * at the structural level; `events`/`pendingClientEventIds` element types are Stage 4's. */
export interface MatchSessionSnapshot {
  protocolVersion: 1;
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
 */
export interface RecordEventCommand {
  clientEventId: string;
  baseVersion: number;
  event: Record<string, unknown>;
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
   * internal API (e.g. a sustained infrastructure failure). This does NOT mean the event was
   * lost — League/Event's own HTTP recordEvent path (`recordLiveEventAction`/
   * `recordEventForActor`) already persisted it canonically before ever calling the realtime
   * path, or runs immediately after this path fails to confirm (see
   * `league-live-match-client.tsx`'s `createLeagueActions.recordEvent`) — it means this
   * object's own copy of the attempt needs no further automatic action and, if this keeps
   * happening, is worth operator attention. */
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
  events: CanonicalLiveEvent[];
}
