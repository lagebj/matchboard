/**
 * Canonical live match state projection (ADR-0112).
 *
 * One match has one observable live-match state. Both the Live Reporting client
 * and the Follow Live viewer derive their display from this same projection.
 * The reporter additionally has mutation controls; the viewer does not.
 *
 * Projection input:
 *   baseline — pre-match roster + lineup + session info (loaded once on mount/refresh)
 *   events   — ordered list of canonical live events (hydrated from snapshot, then
 *              appended via realtime callbacks)
 *
 * Projection output:
 *   score, clock, onFieldPlayerIds, recentEvents, sessionStatus
 *
 * This module is pure — no React, no network, no Prisma.
 */

import type { MatchPeriod } from "@/generated/prisma/client";
import type { MatchClockState } from "./live-match-types";
import type { ClockAnchor, CanonicalLiveEvent } from "./realtime/realtime-messages";
import { formatElapsedMs } from "./match-clock";

// --- Projection output types ---

export interface LiveMatchScoreProjection {
  goalsFor: number;
  goalsAgainst: number;
}

export interface LiveMatchClockProjection {
  period: MatchPeriod;
  running: boolean;
  /** Server-anchored elapsed milliseconds at the clock anchor point. */
  elapsedAtAnchorMs: number;
  /** Server time (epoch ms) when the clock anchor was established. */
  anchorServerTimeMs: number;
}

export interface LiveMatchOnFieldProjection {
  /** Player IDs currently on the field. */
  playerIds: string[];
}

export interface LiveMatchSessionProjection {
  status: "ACTIVE" | "ENDED";
}

export interface LiveMatchPositionsProjection {
  /** playerId -> most recently recorded position, for a player who has had at least one
   * `POSITIONS_CHANGED` event. A player never present here has no recorded position change in
   * this event window — that is not the same as "no position" (ARR-0047, Bundle 5). */
  byPlayerId: Record<string, string | null>;
}

export interface LiveMatchProjectionState {
  score: LiveMatchScoreProjection;
  clock: LiveMatchClockProjection;
  onField: LiveMatchOnFieldProjection;
  positions: LiveMatchPositionsProjection;
  recentEvents: CanonicalLiveEvent[];
  session: LiveMatchSessionProjection;
  /** Monotonic version from the realtime protocol. */
  version: number;
  /** Replay anomalies worth surfacing (e.g. an unresolvable reversal target) — never blocks the
   * projection from producing a best-effort result, but never silently swallowed either (Bundle
   * 5, work item 10 "replay diagnostics"). Empty in the ordinary case. */
  diagnostics: string[];
}

// --- Baseline type (what the pre-match package provides) ---

export interface LiveMatchBaselineSquadPlayer {
  playerId: string;
  playerName: string;
  startingOnField: boolean;
  isActiveParticipant?: boolean;
}

export interface LiveMatchBaseline {
  squad: LiveMatchBaselineSquadPlayer[];
  activeSession:
    | {
        id: string;
        coachId: string;
        startedAt: string;
        /** Persisted match clock (ADR-0133 H2), serialized. `startedAt` is an ISO string. */
        clock?: {
          period: string;
          running: boolean;
          startedAt: string | null;
          elapsedBeforeStartMs: number;
        };
      }
    | null;
}

// --- Shared event reducer (ADR-0138 Bundle 5, ARR-0047) ---
//
// One pure reducer for score / on-field players / positions, shared by the Live Reporting
// client (over `LiveEventSummary[]`, `live-match-reconciliation.ts`) and the Follow Live
// projection (`projectCanonicalLiveState` below, over `CanonicalLiveEvent[]`). Before this
// bundle these were two independent implementations that could (and did — ARR-0047) diverge.
// Generic over any event shape carrying at least these fields, so neither wire type needs to be
// widened to match the other.

export interface ReducibleLiveEvent {
  id: string;
  eventType: string;
  playerId?: string | null;
  correctsEventId?: string | null;
  positionChange?: { fromPosition: string | null; toPosition: string } | null;
}

export interface ReducedLiveEventState {
  goalsFor: number;
  goalsAgainst: number;
  /** Order-preserving, deduplicated. */
  onFieldPlayerIds: string[];
  positions: Record<string, string | null>;
  /** Replay anomalies (Bundle 5, work item 10) — never blocks reduction, never silently
   * swallowed. Empty in the ordinary case. */
  diagnostics: string[];
}

/**
 * Reduce an ordered event list into score / on-field / position facts. `events` must already be
 * in canonical replay order (by `sequence` where the caller has it) — this function does not
 * re-sort, matching every other "pure reducer over pre-ordered input" function in this codebase.
 */
export function reduceLiveEvents<E extends ReducibleLiveEvent>(
  events: readonly E[],
  initialOnFieldPlayerIds: readonly string[],
  initialPositions: Readonly<Record<string, string | null>> = {},
): ReducedLiveEventState {
  let goalsFor = 0;
  let goalsAgainst = 0;
  const onFieldPlayerIds = [...initialOnFieldPlayerIds];
  const positions: Record<string, string | null> = { ...initialPositions };
  const diagnostics: string[] = [];

  const seenEventIds = new Set(events.map((e) => e.id));

  // Reversal handling resolves the *targeted* event via `correctsEventId` — never the reversal
  // event's own id. This is the confirmed ARR-0047 fix: the previous logic added the reversal
  // event's own id to the exclusion set, so a reversed goal was never actually un-counted.
  const reversedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType !== "EVENT_REVERSED") continue;
    if (!event.correctsEventId) {
      diagnostics.push(`EVENT_REVERSED (${event.id}) has no correctsEventId — cannot resolve reversal target`);
      continue;
    }
    if (!seenEventIds.has(event.correctsEventId)) {
      diagnostics.push(
        `EVENT_REVERSED (${event.id}) targets ${event.correctsEventId}, which is not present in this event window`,
      );
    }
    reversedEventIds.add(event.correctsEventId);
  }

  for (const event of events) {
    if (event.eventType === "EVENT_REVERSED") continue;
    if (reversedEventIds.has(event.id)) continue;

    switch (event.eventType) {
      case "GOAL_FOR":
        goalsFor++;
        break;
      case "GOAL_AGAINST":
        goalsAgainst++;
        break;
      case "ROTATION_OUT":
        if (event.playerId) {
          const idx = onFieldPlayerIds.indexOf(event.playerId);
          if (idx !== -1) onFieldPlayerIds.splice(idx, 1);
        }
        break;
      case "ROTATION_IN":
        if (event.playerId && !onFieldPlayerIds.includes(event.playerId)) {
          onFieldPlayerIds.push(event.playerId);
        }
        break;
      case "POSITIONS_CHANGED":
        if (event.playerId && event.positionChange) {
          positions[event.playerId] = event.positionChange.toPosition;
        }
        break;
      default:
        // Every other known event type (MATCH_START/PERIOD_*/MATCH_END/SCORER_SET/ASSIST_SET/
        // FAIR_PLAY_*/MOMENT_MARKED/CLOCK_ADJUSTMENT/EVENT_CORRECTED) is an annotation, clock/
        // period marker, or metadata correction — none carry a score/on-field/position fact of
        // their own.
        break;
    }
  }

  return { goalsFor, goalsAgainst, onFieldPlayerIds, positions, diagnostics };
}

// --- Projection logic ---

/**
 * Compute the canonical observable live-match state from a baseline roster
 * and an ordered list of events.
 */
export function projectCanonicalLiveState(
  baseline: LiveMatchBaseline,
  events: CanonicalLiveEvent[],
  clockAnchor: ClockAnchor | null,
  sessionStatus: "ACTIVE" | "ENDED",
  version: number,
): LiveMatchProjectionState {
  const initialOnFieldPlayerIds = baseline.squad
    .filter((p) => p.isActiveParticipant !== false && p.startingOnField)
    .map((p) => p.playerId);

  const reduced = reduceLiveEvents(events, initialOnFieldPlayerIds);
  const clock = deriveClockProjection(clockAnchor, events);

  return {
    score: { goalsFor: reduced.goalsFor, goalsAgainst: reduced.goalsAgainst },
    clock,
    onField: { playerIds: reduced.onFieldPlayerIds },
    positions: { byPlayerId: reduced.positions },
    recentEvents: events.slice(-50),
    session: { status: sessionStatus },
    version,
    diagnostics: reduced.diagnostics,
  };
}

/**
 * Derive clock projection from a ClockAnchor (server-provided) or events.
 */
function deriveClockProjection(
  anchor: ClockAnchor | null,
  events: CanonicalLiveEvent[],
): LiveMatchClockProjection {
  if (anchor) {
    return {
      period: anchor.period,
      running: anchor.running,
      elapsedAtAnchorMs: anchor.matchSecondsAtAnchor,
      anchorServerTimeMs: anchor.anchorServerTimeMs,
    };
  }

  // Fallback (no materialized anchor yet — e.g. before the first snapshot ever loads): the
  // clock ANCHOR is the one authoritative materialized clock state (DECISIONS.md D07-adjacent —
  // the anchor is always preferred when present); this branch only approximates a period from
  // the events themselves, and now reads the latest period-carrying event's own `period` field
  // directly (Bundle 5, work item 4) rather than pattern-matching on MATCH_START/MATCH_END event
  // types, which could not distinguish e.g. HALF_TIME or a later period at all.
  let period: MatchPeriod = "BEFORE";
  for (const event of events) {
    if (event.period) period = event.period;
    else if (event.eventType === "MATCH_START") period = "FIRST_HALF";
    else if (event.eventType === "MATCH_END") period = "FULL_TIME";
  }

  const isPlaying = period !== "BEFORE" && period !== "FULL_TIME" &&
    period !== ("HALF_TIME" as MatchPeriod) && period !== ("EXTRA_HALF_TIME" as MatchPeriod);

  return {
    period,
    running: isPlaying,
    elapsedAtAnchorMs: 0,
    anchorServerTimeMs: 0,
  };
}

/**
 * Reconstruct a MatchClockState from a LiveMatchClockProjection.
 * Bridges the projection to the existing clock state format used by LiveMatchClient.
 */
export function clockProjectionToClockState(
  projection: LiveMatchClockProjection,
): MatchClockState {
  if (projection.running && projection.anchorServerTimeMs > 0) {
    return {
      period: projection.period,
      running: true,
      startedAt: new Date(projection.anchorServerTimeMs),
      elapsedBeforeStartMs: projection.elapsedAtAnchorMs,
    };
  }
  return {
    period: projection.period,
    running: false,
    startedAt: null,
    elapsedBeforeStartMs: projection.elapsedAtAnchorMs,
  };
}

/**
 * Convert a snapshot's ClockAnchor to a LiveMatchClockProjection.
 */
export function clockAnchorToProjection(anchor: ClockAnchor): LiveMatchClockProjection {
  return {
    period: anchor.period,
    running: anchor.running,
    elapsedAtAnchorMs: anchor.matchSecondsAtAnchor,
    anchorServerTimeMs: anchor.anchorServerTimeMs,
  };
}

/**
 * Merge snapshot events with realtime events, deduplicating by event ID and clientEventId, and
 * ordering canonically.
 *
 * ARR-0047 (Bundle 5) fix: order by persisted `sequence` first (never `createdAt` string
 * comparison alone), matching the exact ordering the internal snapshot route and the Worker's
 * own `evaluateReconciliation` already use — `createdAt`/`id` remain the deterministic
 * tie-breaker for a legacy/pre-migration row with no `sequence` (nulls sort last, matching
 * Postgres `ORDER BY sequence ASC`'s own default null-ordering these other call sites rely on).
 */
export function mergeSnapshotWithRealtimeEvents(
  snapshotEvents: CanonicalLiveEvent[],
  _snapshotVersion: number,
  realtimeEvents: CanonicalLiveEvent[],
  _lastAppliedVersion: number,
): CanonicalLiveEvent[] {
  const eventMap = new Map<string, CanonicalLiveEvent>();
  for (const event of snapshotEvents) {
    eventMap.set(event.id, event);
  }

  for (const event of realtimeEvents) {
    if (eventMap.has(event.id)) continue;
    // Also check by clientEventId for dedup
    let isDuplicate = false;
    for (const [, existing] of eventMap) {
      if (existing.clientEventId && existing.clientEventId === event.clientEventId) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;
    eventMap.set(event.id, event);
  }

  return Array.from(eventMap.values()).sort(compareByCanonicalOrder);
}

function compareByCanonicalOrder(a: CanonicalLiveEvent, b: CanonicalLiveEvent): number {
  const aSeq = typeof a.sequence === "number" ? a.sequence : null;
  const bSeq = typeof b.sequence === "number" ? b.sequence : null;
  if (aSeq !== null && bSeq !== null) return aSeq - bSeq;
  if (aSeq !== null) return -1; // a has a real sequence, b does not — a sorts first
  if (bSeq !== null) return 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Build a player map (playerId → playerName) from squad data.
 */
export function buildPlayerMap(squad: LiveMatchBaselineSquadPlayer[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of squad) {
    map[p.playerId] = p.playerName;
  }
  return map;
}

/**
 * Convert a CanonicalLiveEvent to a display-friendly summary.
 * Includes match clock timestamp (period + elapsed time) when available.
 */
export function canonicalEventToSummary(
  event: CanonicalLiveEvent,
  playerMap: Record<string, string>,
): { text: string; id: string; period?: string | null; matchClock?: string } {
  const label = getEventTypeLabelLocal(event.eventType);
  const playerName = event.playerId ? playerMap[event.playerId] : undefined;
  const secondaryName = event.secondaryPlayerId ? playerMap[event.secondaryPlayerId] : undefined;

  let text = label;
  if (playerName && secondaryName) {
    text = `${label} — ${playerName} / ${secondaryName}`;
  } else if (playerName) {
    text = `${label} — ${playerName}`;
  }

  const periodLabel = event.period ? formatPeriodLabel(event.period) : undefined;
  // Bundle 5 (ADR-0138) fix: `CanonicalLiveEvent.matchSeconds` is already MILLISECONDS (a
  // repo-wide legacy-naming convention documented on `LiveMatchEvent.matchSeconds` in
  // prisma/schema.prisma and throughout AGENTS.md's "Live Match Reporting" section) — this
  // multiplied by 1000 a second time, which would have displayed a wildly inflated elapsed time
  // (e.g. ~16 minutes shown as ~11 days) the moment `matchSeconds` actually reached this
  // function with a real value (previously it did not — see `toCanonicalLiveEvent`'s own
  // Bundle 5 fix — so this was latent rather than yet visible in production).
  const matchClock = event.matchSeconds != null ? formatElapsedMs(event.matchSeconds) : undefined;

  return { text, id: event.id, period: periodLabel, matchClock };
}

function formatPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    BEFORE: "Pre-match",
    FIRST_HALF: "1st half",
    HALF_TIME: "Half time",
    SECOND_HALF: "2nd half",
    EXTRA_FIRST_HALF: "ET 1st half",
    EXTRA_HALF_TIME: "ET half time",
    EXTRA_SECOND_HALF: "ET 2nd half",
    FULL_TIME: "Full time",
  };
  return labels[period] ?? period.replace(/_/g, " ");
}

function getEventTypeLabelLocal(type: string): string {
  const labels: Record<string, string> = {
    MATCH_START: "Match started",
    PERIOD_START: "Period started",
    PERIOD_END: "Period ended",
    MATCH_END: "Match ended",
    GOAL_FOR: "Goal — us",
    GOAL_AGAINST: "Goal — them",
    SCORER_SET: "Scorer recorded",
    ASSIST_SET: "Assist recorded",
    ROTATION_OUT: "Player left",
    ROTATION_IN: "Player entered",
    POSITIONS_CHANGED: "Positions changed",
    FAIR_PLAY_POSITIVE: "Fair play — positive",
    FAIR_PLAY_CONCERN: "Fair play — concern",
    MOMENT_MARKED: "Moment marked",
    CLOCK_ADJUSTMENT: "Clock adjusted",
    EVENT_CORRECTED: "Event corrected",
    EVENT_REVERSED: "Event reversed",
  };
  return labels[type] ?? type;
}