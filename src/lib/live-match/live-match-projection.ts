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

export interface LiveMatchProjectionState {
  score: LiveMatchScoreProjection;
  clock: LiveMatchClockProjection;
  onField: LiveMatchOnFieldProjection;
  recentEvents: CanonicalLiveEvent[];
  session: LiveMatchSessionProjection;
  /** Monotonic version from the realtime protocol. */
  version: number;
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
  activeSession: { id: string; coachId: string; startedAt: string } | null;
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
  let goalsFor = 0;
  let goalsAgainst = 0;
  const onFieldPlayerIds: string[] = baseline.squad
    .filter((p) => p.isActiveParticipant !== false && p.startingOnField)
    .map((p) => p.playerId);

  // Track reversed event IDs (by id and clientEventId)
  const reversedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType === "EVENT_REVERSED") {
      // EVENT_REVERSED doesn't carry correctsEventId in CanonicalLiveEvent
      // but it signals that the most recent GOAL_FOR/GOAL_AGAINST should be reversed.
      // For now, mark the reversed event itself so it's not counted.
      reversedEventIds.add(event.id);
    }
  }

  for (const event of events) {
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
      default:
        break;
    }
  }

  const clock = deriveClockProjection(clockAnchor, events);

  return {
    score: { goalsFor, goalsAgainst },
    clock,
    onField: { playerIds: onFieldPlayerIds },
    recentEvents: events.slice(-50),
    session: { status: sessionStatus },
    version,
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

  // Fallback: reconstruct period from event sequence
  let period: MatchPeriod = "BEFORE";
  for (const event of events) {
    if (event.eventType === "MATCH_START") period = "FIRST_HALF";
    else if (event.eventType === "MATCH_END") period = "FULL_TIME";
    // Period transition events don't carry period info in CanonicalLiveEvent,
    // so we can't reconstruct detailed period state from them alone.
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
 * Merge snapshot events with realtime events, deduplicating by event ID
 * and clientEventId.
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

  return Array.from(eventMap.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
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
  const matchClock = event.matchSeconds != null ? formatElapsedMs(event.matchSeconds * 1000) : undefined;

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