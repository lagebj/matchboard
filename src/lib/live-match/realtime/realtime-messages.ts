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
 * Minimal for Stage 1: enough to appear in a snapshot's `events` array; Stage 4 defines the
 * exact fields once it reads real rows via `recordEventForActor`/canonical persistence. */
export interface CanonicalLiveEvent {
  id: string;
  clientEventId: string;
  eventType: string;
  createdAt: string;
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
  persistenceStatus: "pending" | "persisted";
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
  persistenceStatus: "pending" | "persisted" | "failed_terminal";
}

export interface PresenceChangedCallback {
  connectedCount: number;
}

export interface SessionEndedCallback {
  version: number;
}

export interface ForceResyncCallback {
  reason: string;
}
