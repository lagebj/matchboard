import { db } from "@/lib/db";
import type { MatchPeriod } from "@/generated/prisma/client";
import {
  getActualPositionIntervalsForRef,
  type ActualIntervalRow,
} from "@/lib/evidence/actual-timeline";
import {
  getGoalAttributionEventsForRef,
  type GoalAttributionEvent,
} from "@/lib/evidence/combination-goal-attribution";
import { footballMatchRefEvidenceLeagueSeasonId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { getEffectiveEventSquadMatchTiming, getEffectiveEventTeamGameFormat } from "@/lib/events/event-types";
import {
  getCumulativePeriodOffsetsMs,
  getEventPeriodConfig,
  getLeaguePeriodConfig,
  getTotalPeriodDurationMs,
  resolvePeriodForAbsoluteMs,
  type PeriodConfig,
} from "@/lib/live-match/period-config";

/**
 * Bundle 1 of the Evidence-Informed Match Planning programme: one canonical, deterministically
 * reconstructed representation of actual on-field state through a completed match. Extends
 * ADR-0096/ADR-0104's `ActualPositionInterval` + `FootballMatchRef` owners rather than creating a
 * parallel history subsystem — everything here is DERIVED on read (D-002: derive first, persist
 * selectively). Nothing in this file is persisted; see ADR-0113.
 *
 * `MatchSegment`/`buildSegmentsFromIntervals` (the boundary/on-pitch-composition primitive) were
 * moved here from `combination-topology.ts`, which now imports them from this module — this is
 * the same primitive combination evidence already used, generalized into the canonical owner
 * rather than duplicated (AGENTS.md "One business operation, one owning implementation").
 */

// ---------------------------------------------------------------------------
// Segment primitive (extended from combination-topology.ts's original private helper)
// ---------------------------------------------------------------------------

/** A player's occupied slot at a point in time. See combination-topology.ts for field meaning. */
export type PlayerSlot = { position: string; line: string | null; lane: string | null };

export interface MatchSegment {
  startMs: number;
  endMs: number;
  playersOnPitch: Map<string, PlayerSlot>;
}

/**
 * Splits a match's actual position intervals into maximal segments of constant on-pitch
 * composition. A segment boundary exists only where a real recorded change happened — this
 * never invents a boundary at, say, half-time when no substitution/position-change was actually
 * recorded there (D-002, MIGRATION.md: "do not synthesize exact event timing that was never
 * recorded").
 */
export function buildSegmentsFromIntervals(intervals: ActualIntervalRow[], matchEndMs: number | null): MatchSegment[] {
  if (intervals.length === 0) return [];

  const endTimePoints = new Set<number>();
  endTimePoints.add(0);

  for (const interval of intervals) {
    if (interval.position !== "BENCH" && interval.position !== "unknown") {
      endTimePoints.add(interval.startedAtMs);
      if (interval.endedAtMs !== null) {
        endTimePoints.add(interval.endedAtMs);
      }
    }
  }

  if (matchEndMs !== null) {
    endTimePoints.add(matchEndMs);
  }

  const sortedTimes = [...endTimePoints].sort((a, b) => a - b);
  const segments: MatchSegment[] = [];

  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const startMs = sortedTimes[i]!;
    const endMs = sortedTimes[i + 1]!;

    const playersOnPitch = new Map<string, PlayerSlot>();
    for (const interval of intervals) {
      if (interval.position === "BENCH" || interval.position === "unknown") continue;
      const intervalStart = interval.startedAtMs;
      const intervalEnd = interval.endedAtMs ?? matchEndMs ?? Infinity;
      if (intervalStart <= startMs && intervalEnd > startMs) {
        playersOnPitch.set(interval.playerId, {
          position: interval.position,
          line: interval.line,
          lane: interval.lane,
        });
      }
    }

    if (playersOnPitch.size >= 2) {
      segments.push({ startMs, endMs, playersOnPitch });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Match phase windows
// ---------------------------------------------------------------------------

export type MatchPhaseKey =
  | "OPENING_5"
  | "OPENING_10"
  | "IMMEDIATELY_AFTER_RESTART"
  | "LATE_PERIOD"
  | "FINAL_10"
  | "FINAL_5";

export interface MatchPhaseWindow {
  key: MatchPhaseKey;
  period: MatchPeriod;
  startMs: number;
  endMs: number;
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

/**
 * Scales a "senior football" window (5/10 minutes) down for a shorter period duration (e.g. a
 * 3v3 event format with 10-minute halves), so "opening 10" never claims more than a fixed
 * fraction of a short period — PROGRAMME.md: "Derive human-useful windows from configured/actual
 * game format, not assumed senior-football halves."
 */
function scaledWindowMs(periodDurationMs: number, fixedMs: number, maxFraction: number): number {
  return Math.max(0, Math.min(fixedMs, Math.round(periodDurationMs * maxFraction)));
}

/**
 * Derives named, human-useful phase windows (opening 5/10, late period, immediately after
 * restart, final 10/5) from a match's actual/configured period config. Only playing periods with
 * a known duration produce windows — an undurated period contributes none, rather than a guess.
 */
export function getMatchPhaseWindows(config: PeriodConfig[]): MatchPhaseWindow[] {
  const offsets = getCumulativePeriodOffsetsMs(config);
  const playingPeriods = config.filter((p) => p.type === "playing" && p.durationMs != null);
  const windows: MatchPhaseWindow[] = [];

  playingPeriods.forEach((period, index) => {
    const durationMs = period.durationMs!;
    const startMs = offsets[period.key] ?? 0;
    const endMs = startMs + durationMs;
    const isRestart = index > 0;
    const isFinalPeriod = index === playingPeriods.length - 1;

    const opening5 = scaledWindowMs(durationMs, FIVE_MIN_MS, 0.25);
    const opening10 = scaledWindowMs(durationMs, TEN_MIN_MS, 0.4);
    const late = scaledWindowMs(durationMs, TEN_MIN_MS, 0.4);

    if (opening5 > 0) {
      windows.push({ key: "OPENING_5", period: period.key, startMs, endMs: startMs + opening5 });
    }
    if (opening10 > 0) {
      windows.push({ key: "OPENING_10", period: period.key, startMs, endMs: startMs + opening10 });
    }
    if (isRestart && opening5 > 0) {
      windows.push({ key: "IMMEDIATELY_AFTER_RESTART", period: period.key, startMs, endMs: startMs + opening5 });
    }
    if (late > 0) {
      windows.push({ key: "LATE_PERIOD", period: period.key, startMs: endMs - late, endMs });
    }
    if (isFinalPeriod) {
      const final10 = scaledWindowMs(durationMs, TEN_MIN_MS, 0.4);
      const final5 = scaledWindowMs(durationMs, FIVE_MIN_MS, 0.25);
      if (final10 > 0) {
        windows.push({ key: "FINAL_10", period: period.key, startMs: endMs - final10, endMs });
      }
      if (final5 > 0) {
        windows.push({ key: "FINAL_5", period: period.key, startMs: endMs - final5, endMs });
      }
    }
  });

  return windows;
}

/** Which named phase windows overlap the half-open range `[rangeStartMs, rangeEndMs)`. */
export function classifyMatchPhases(
  rangeStartMs: number,
  rangeEndMs: number,
  windows: MatchPhaseWindow[],
): MatchPhaseKey[] {
  return windows
    .filter((w) => rangeStartMs < w.endMs && rangeEndMs > w.startMs)
    .map((w) => w.key);
}

// ---------------------------------------------------------------------------
// Canonical match-state interval / transition
// ---------------------------------------------------------------------------

export type MatchTimingQuality = "EXACT" | "INFERRED" | "PARTIAL" | "UNAVAILABLE";

export interface MatchStateOpponentContext {
  opponentTeamId: string | null;
  displayName: string;
}

export interface MatchStateContext {
  organisationId: string;
  footballGroupId: string | null;
  leagueSeasonId: string | null;
  gameFormat: string | null;
  opponent: MatchStateOpponentContext;
  periodConfig: PeriodConfig[];
  matchEndMs: number | null;
}

export interface MatchStatePlayer {
  playerId: string;
  position: string;
  line: string | null;
  lane: string | null;
}

export interface MatchStateScore {
  for: number;
  against: number;
}

export interface MatchStateInterval {
  startMs: number;
  endMs: number;
  durationMs: number;
  period: MatchPeriod | null;
  matchPhases: MatchPhaseKey[];
  players: MatchStatePlayer[];
  structuralSummary: {
    onPitchCount: number;
    byLine: Record<string, number>;
    byLane: Record<string, number>;
  };
  scoreAtStart: MatchStateScore;
  scoreAtEnd: MatchStateScore;
  goalsFor: number;
  goalsAgainst: number;
  timingQuality: MatchTimingQuality;
}

export type TransitionDisruptionDescriptor =
  | "SUBSTITUTION_ONLY"
  | "POSITION_ONLY"
  | "SUBSTITUTION_WITH_RESHUFFLE"
  | "SINGLE_LINE_CHANGE"
  | "MULTI_LINE_CHANGE"
  | "CENTRAL_AXIS_CHANGED";

export interface MatchTransitionPositionChange {
  playerId: string;
  fromPosition: string;
  toPosition: string;
  fromLine: string | null;
  toLine: string | null;
}

export interface MatchTransition {
  atMs: number;
  period: MatchPeriod | null;
  playersOff: string[];
  playersOn: string[];
  playersRemaining: string[];
  positionOnlyChanges: MatchTransitionPositionChange[];
  substitutionCount: number;
  changedLines: string[];
  isSimultaneousSubstitutionAndReshuffle: boolean;
  disruptionDescriptors: TransitionDisruptionDescriptor[];
  scoreBefore: MatchStateScore;
  scoreAfter: MatchStateScore;
  isAtNaturalBreak: boolean;
}

export interface MatchStateTimeline {
  context: MatchStateContext;
  intervals: MatchStateInterval[];
  transitions: MatchTransition[];
  phaseWindows: MatchPhaseWindow[];
  timingQuality: MatchTimingQuality;
}

function cumulativeGoalsBefore(goalEvents: GoalAttributionEvent[], beforeMs: number): MatchStateScore {
  let forCount = 0;
  let againstCount = 0;
  for (const event of goalEvents) {
    if (event.matchMs >= beforeMs) continue;
    if (event.team === "FOR") forCount += 1;
    else againstCount += 1;
  }
  return { for: forCount, against: againstCount };
}

function goalsWithin(goalEvents: GoalAttributionEvent[], startMs: number, endMs: number): { goalsFor: number; goalsAgainst: number } {
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const event of goalEvents) {
    if (event.matchMs < startMs || event.matchMs >= endMs) continue;
    if (event.team === "FOR") goalsFor += 1;
    else goalsAgainst += 1;
  }
  return { goalsFor, goalsAgainst };
}

function intervalTimingQuality(intervals: ActualIntervalRow[], segment: MatchSegment): MatchTimingQuality {
  let approximate = false;
  let unknown = false;
  for (const interval of intervals) {
    if (!segment.playersOnPitch.has(interval.playerId)) continue;
    const intervalEnd = interval.endedAtMs ?? Infinity;
    if (interval.startedAtMs > segment.startMs || intervalEnd <= segment.startMs) continue;
    if (interval.approximateTiming) approximate = true;
    if (interval.position === "unknown") unknown = true;
  }
  if (unknown) return "PARTIAL";
  return approximate ? "INFERRED" : "EXACT";
}

/**
 * Pure derivation of canonical match-state intervals from an already-fetched actual position
 * timeline. Kept separate from the DB-bound orchestrator (`buildMatchStateTimeline`) so tests can
 * exercise the domain logic with plain fixtures (TEST-MATRIX.md §1).
 */
export function deriveMatchStateIntervals(
  intervals: ActualIntervalRow[],
  goalEvents: GoalAttributionEvent[],
  context: MatchStateContext,
): MatchStateInterval[] {
  const segments = buildSegmentsFromIntervals(intervals, context.matchEndMs);
  const offsets = getCumulativePeriodOffsetsMs(context.periodConfig);
  const phaseWindows = getMatchPhaseWindows(context.periodConfig);

  return segments.map((segment) => {
    const players: MatchStatePlayer[] = [...segment.playersOnPitch.entries()].map(([playerId, slot]) => ({
      playerId,
      position: slot.position,
      line: slot.line,
      lane: slot.lane,
    }));

    const byLine: Record<string, number> = {};
    const byLane: Record<string, number> = {};
    for (const player of players) {
      if (player.line) byLine[player.line] = (byLine[player.line] ?? 0) + 1;
      if (player.lane) byLane[player.lane] = (byLane[player.lane] ?? 0) + 1;
    }

    const { goalsFor, goalsAgainst } = goalsWithin(goalEvents, segment.startMs, segment.endMs);
    const period = resolvePeriodForAbsoluteMs(segment.startMs, context.periodConfig, offsets);

    return {
      startMs: segment.startMs,
      endMs: segment.endMs,
      durationMs: segment.endMs - segment.startMs,
      period,
      matchPhases: classifyMatchPhases(segment.startMs, segment.endMs, phaseWindows),
      players,
      structuralSummary: { onPitchCount: players.length, byLine, byLane },
      scoreAtStart: cumulativeGoalsBefore(goalEvents, segment.startMs),
      scoreAtEnd: cumulativeGoalsBefore(goalEvents, segment.endMs),
      goalsFor,
      goalsAgainst,
      timingQuality: intervalTimingQuality(intervals, segment),
    };
  });
}

/**
 * Pure derivation of canonical transitions from already-derived match-state intervals. A
 * transition exists only between two adjacent intervals — there is exactly one boundary per
 * pair, matching "a transition happens only where a real recorded change happened"
 * (buildSegmentsFromIntervals never invents a boundary that wasn't actually observed).
 */
export function deriveMatchTransitions(stateIntervals: MatchStateInterval[]): MatchTransition[] {
  const transitions: MatchTransition[] = [];

  for (let i = 0; i < stateIntervals.length - 1; i++) {
    const before = stateIntervals[i]!;
    const after = stateIntervals[i + 1]!;

    const beforeById = new Map(before.players.map((p) => [p.playerId, p]));
    const afterById = new Map(after.players.map((p) => [p.playerId, p]));

    const playersOff = before.players.filter((p) => !afterById.has(p.playerId)).map((p) => p.playerId);
    const playersOn = after.players.filter((p) => !beforeById.has(p.playerId)).map((p) => p.playerId);
    const playersRemaining = before.players
      .filter((p) => afterById.has(p.playerId))
      .map((p) => p.playerId);

    const positionOnlyChanges: MatchTransitionPositionChange[] = [];
    for (const playerId of playersRemaining) {
      const from = beforeById.get(playerId)!;
      const to = afterById.get(playerId)!;
      if (from.position !== to.position || from.line !== to.line || from.lane !== to.lane) {
        positionOnlyChanges.push({
          playerId,
          fromPosition: from.position,
          toPosition: to.position,
          fromLine: from.line,
          toLine: to.line,
        });
      }
    }

    const changedLines = new Set<string>();
    for (const playerId of playersOff) {
      const line = beforeById.get(playerId)?.line;
      if (line) changedLines.add(line);
    }
    for (const playerId of playersOn) {
      const line = afterById.get(playerId)?.line;
      if (line) changedLines.add(line);
    }
    for (const change of positionOnlyChanges) {
      if (change.fromLine) changedLines.add(change.fromLine);
      if (change.toLine) changedLines.add(change.toLine);
    }

    const substitutionCount = Math.max(playersOff.length, playersOn.length);
    const hasSubstitution = substitutionCount > 0;
    const hasPositionOnly = positionOnlyChanges.length > 0;

    const disruptionDescriptors: TransitionDisruptionDescriptor[] = [];
    if (hasSubstitution && hasPositionOnly) disruptionDescriptors.push("SUBSTITUTION_WITH_RESHUFFLE");
    else if (hasSubstitution) disruptionDescriptors.push("SUBSTITUTION_ONLY");
    else if (hasPositionOnly) disruptionDescriptors.push("POSITION_ONLY");

    if (changedLines.size > 0) {
      disruptionDescriptors.push(changedLines.size <= 1 ? "SINGLE_LINE_CHANGE" : "MULTI_LINE_CHANGE");
    }
    if (changedLines.has("DEF") && changedLines.has("MID")) {
      disruptionDescriptors.push("CENTRAL_AXIS_CHANGED");
    }

    transitions.push({
      atMs: after.startMs,
      period: after.period ?? before.period,
      playersOff,
      playersOn,
      playersRemaining,
      positionOnlyChanges,
      substitutionCount,
      changedLines: [...changedLines],
      isSimultaneousSubstitutionAndReshuffle: hasSubstitution && hasPositionOnly,
      disruptionDescriptors,
      scoreBefore: before.scoreAtEnd,
      scoreAfter: after.scoreAtStart,
      isAtNaturalBreak: before.period !== null && after.period !== null && before.period !== after.period,
    });
  }

  return transitions;
}

function overallTimingQuality(intervals: MatchStateInterval[]): MatchTimingQuality {
  if (intervals.length === 0) return "UNAVAILABLE";
  if (intervals.some((i) => i.timingQuality === "PARTIAL")) return "PARTIAL";
  if (intervals.some((i) => i.timingQuality === "INFERRED")) return "INFERRED";
  return "EXACT";
}

/**
 * Resolves the match/team-season/group/opponent/period context a `FootballMatchRef` needs for
 * canonical match-state derivation. League and Event each resolve their own source-specific
 * fields, converging on one shared `MatchStateContext` shape (mirrors the adapter pattern
 * `src/lib/evidence/adapters/*` already established for `FootballMatchRef` itself).
 */
export async function resolveMatchStateContext(ref: FootballMatchRef): Promise<MatchStateContext | null> {
  const leagueSeasonId = footballMatchRefEvidenceLeagueSeasonId(ref);

  if (ref.kind === "LEAGUE_MATCH") {
    const match = await db.match.findFirst({
      where: { id: ref.matchId },
      select: {
        organisationId: true,
        matchType: true,
        matchDurationMinutes: true,
        gameFormat: true,
        opponent: true,
        opponentTeamId: true,
        opponentTeam: { select: { displayName: true } },
        team: { select: { footballGroupId: true } },
      },
    });
    if (!match) return null;

    const periodConfig = getLeaguePeriodConfig(match.matchType);
    return {
      organisationId: match.organisationId,
      footballGroupId: match.team.footballGroupId,
      leagueSeasonId,
      gameFormat: match.gameFormat,
      opponent: {
        opponentTeamId: match.opponentTeamId,
        displayName: match.opponentTeam?.displayName ?? match.opponent,
      },
      periodConfig,
      matchEndMs: match.matchDurationMinutes ? match.matchDurationMinutes * 60 * 1000 : null,
    };
  }

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: ref.eventMatchId },
    select: {
      organisationId: true,
      opponentName: true,
      opponentTeamId: true,
      opponentTeam: { select: { displayName: true } },
      event: {
        select: {
          numberOfHalves: true,
          matchDurationMinutes: true,
          breakDurationMinutes: true,
          gameFormat: true,
          footballGroupId: true,
        },
      },
      eventSquad: {
        select: {
          numberOfHalvesOverride: true,
          matchDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
          gameFormatOverride: true,
        },
      },
    },
  });
  if (!eventMatch) return null;

  const timing = getEffectiveEventSquadMatchTiming(eventMatch.event, eventMatch.eventSquad);
  const periodConfig = getEventPeriodConfig(timing.matchDurationMinutes, timing.numberOfHalves, timing.breakDurationMinutes);

  return {
    organisationId: eventMatch.organisationId,
    footballGroupId: eventMatch.event.footballGroupId,
    leagueSeasonId,
    gameFormat: getEffectiveEventTeamGameFormat(eventMatch.event, eventMatch.eventSquad),
    opponent: {
      opponentTeamId: eventMatch.opponentTeamId,
      displayName: eventMatch.opponentTeam?.displayName ?? eventMatch.opponentName,
    },
    periodConfig,
    matchEndMs: getTotalPeriodDurationMs(periodConfig),
  };
}

/**
 * The canonical, deterministic reconstruction of actual on-field match state for one completed
 * League or Event match (Bundle 1 completion condition). Read-only, no persistence, no planning
 * advice — later programme bundles consume this as their shared foundation.
 */
export async function buildMatchStateTimeline(ref: FootballMatchRef): Promise<MatchStateTimeline | null> {
  const context = await resolveMatchStateContext(ref);
  if (!context) return null;

  const [intervals, goalEvents] = await Promise.all([
    getActualPositionIntervalsForRef(ref),
    getGoalAttributionEventsForRef(ref),
  ]);

  const stateIntervals = deriveMatchStateIntervals(intervals, goalEvents, context);
  const transitions = deriveMatchTransitions(stateIntervals);
  const phaseWindows = getMatchPhaseWindows(context.periodConfig);

  return {
    context,
    intervals: stateIntervals,
    transitions,
    phaseWindows,
    timingQuality: overallTimingQuality(stateIntervals),
  };
}
