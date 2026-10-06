import type { MatchRhythmSample } from "@/lib/team-season-profile/pattern-catalogue";
import { classifyRateTrajectory } from "@/lib/team-season-profile/trajectory";
import type { TeamSeasonPattern, ConfidenceLevel } from "@/lib/team-season-profile/contracts";

/**
 * Player goal/assist contribution builder (`03_PATTERN_CATALOGUE_V1.md` §C1/C2). V1 is
 * intentionally limited to goals and assists -- the only canonical event types Matchboard
 * records reliably for League matches (locked decision: do not invent shots/xG/progressive
 * passes). §C3 (combined goal+assist summary) and §C4 (event-context distribution) are
 * explicitly optional in the bundle and out of scope for this slice.
 *
 * Reuses the exact same `MatchRhythmSample.goalEvents` (`GoalAttributionEvent[]`,
 * `combination-goal-attribution.ts`) that `pattern-catalogue.ts` already loads for match-rhythm
 * patterns -- a goal's scorer/assist attribution is read once, not re-derived here.
 */

export type PlayerMatchInterval = { position: string; startedAtMs: number; endedAtMs: number | null };

export type PlayerMatchExposure = {
  matchId: string;
  startsAt: Date;
  playerId: string;
  minutesPlayed: number;
  intervals: PlayerMatchInterval[];
};

/** §04 "Player contributions" baseline. */
function classifyPlayerContributionConfidence(matches: number, minutes: number): ConfidenceLevel {
  if (matches >= 6 && minutes >= 180) return "ESTABLISHED";
  if (matches >= 3 && minutes >= 60) return "EMERGING";
  return "INSUFFICIENT";
}

function resolvePositionAtMs(intervals: PlayerMatchInterval[], ms: number): string | null {
  const interval = intervals.find((i) => i.position !== "BENCH" && ms >= i.startedAtMs && ms < (i.endedAtMs ?? Infinity));
  return interval?.position ?? null;
}

type ContributionEvent = { matchId: string; startsAt: Date; matchMs: number; approximateTiming: boolean };

function buildContributionPattern(params: {
  playerId: string;
  subtype: "GOAL_CONTRIBUTION" | "ASSIST_CONTRIBUTION";
  events: ContributionEvent[];
  exposureByMatch: Map<string, PlayerMatchExposure>;
  totalMatches: number;
  totalMinutes: number;
  allPositions: string[];
  recentMatchIds: Set<string>;
}): TeamSeasonPattern | null {
  const { playerId, subtype, events, exposureByMatch, totalMatches, totalMinutes, allPositions, recentMatchIds } = params;

  // §C1/C2 surface threshold: >=3 matches, >=60 resolved minutes, >=2 relevant events.
  if (events.length < 2) return null;
  const confidence = classifyPlayerContributionConfidence(totalMatches, totalMinutes);
  if (confidence === "INSUFFICIENT") return null;

  const resolvedPositions = events.map((e) => {
    const exposure = exposureByMatch.get(e.matchId);
    return exposure ? resolvePositionAtMs(exposure.intervals, e.matchMs) : null;
  });

  // Position-context clause only when EVERY contributing event resolves -- a partial/untrustworthy
  // resolution must stay silent rather than imply a position for an event it cannot place
  // (Test plan D.5).
  const allResolved = resolvedPositions.every((p): p is string => p != null);
  let dominantPosition: string | null = null;
  let dominantCount = 0;
  if (allResolved) {
    const counts = new Map<string, number>();
    for (const position of resolvedPositions) counts.set(position, (counts.get(position) ?? 0) + 1);
    for (const [position, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (count > dominantCount) {
        dominantPosition = position;
        dominantCount = count;
      }
    }
  }

  const recentEvents = events.filter((e) => recentMatchIds.has(e.matchId));
  const earlierEvents = events.filter((e) => !recentMatchIds.has(e.matchId));
  const recentMatches = new Set(recentEvents.map((e) => e.matchId));
  const earlierMatches = new Set(earlierEvents.map((e) => e.matchId));
  const recentMinutes = [...recentMatches].reduce((sum, id) => sum + (exposureByMatch.get(id)?.minutesPlayed ?? 0), 0);
  const earlierMinutes = [...earlierMatches].reduce((sum, id) => sum + (exposureByMatch.get(id)?.minutesPlayed ?? 0), 0);

  const trajectory = classifyRateTrajectory(
    { events: earlierEvents.length, exposureHours: earlierMinutes / 60, matches: earlierMatches.size },
    { events: recentEvents.length, exposureHours: recentMinutes / 60, matches: recentMatches.size },
  );

  const dates = events.map((e) => e.startsAt.getTime());

  return {
    key: `player:${playerId}:${subtype === "GOAL_CONTRIBUTION" ? "goal" : "assist"}-contribution`,
    family: "PLAYER_CONTRIBUTION",
    subtype,
    subjects: { playerIds: [playerId], positions: allPositions },
    evidenceStrength: confidence,
    trajectory,
    tone: "NEUTRAL",
    firstObservedAt: new Date(Math.min(...dates)).toISOString(),
    lastObservedAt: new Date(Math.max(...dates)).toISOString(),
    approximateTiming: events.some((e) => e.approximateTiming),
    sample: { matches: totalMatches, exposureMinutes: totalMinutes, eventCount: events.length },
    metrics: {
      eventCount: events.length,
      totalMinutes,
      totalMatches,
      dominantPosition,
      dominantPositionCount: dominantCount,
    },
    sourceRefs: [...new Set(events.map((e) => `match:${e.matchId}`))],
  };
}

/**
 * Builds §C1 (goal contribution) and §C2 (assist contribution) patterns for every real Player
 * (never a guest -- `realPlayerIds` gates this; Test plan D.6/D.7) who clears the exposure and
 * event-count thresholds. `exposures` must already be limited to this team's eligible League
 * matches for the selected season; `recentMatchIds` must be a subset of those matches.
 */
export function buildPlayerContributionPatterns(
  samples: MatchRhythmSample[],
  exposures: PlayerMatchExposure[],
  realPlayerIds: Set<string>,
  recentMatchIds: Set<string>,
): TeamSeasonPattern[] {
  const exposureByMatchAndPlayer = new Map<string, PlayerMatchExposure>();
  const totalMatchesByPlayer = new Map<string, Set<string>>();
  const totalMinutesByPlayer = new Map<string, number>();
  const positionsByPlayer = new Map<string, Set<string>>();

  for (const exposure of exposures) {
    if (!realPlayerIds.has(exposure.playerId)) continue;
    exposureByMatchAndPlayer.set(`${exposure.matchId}:${exposure.playerId}`, exposure);

    const matches = totalMatchesByPlayer.get(exposure.playerId) ?? new Set<string>();
    matches.add(exposure.matchId);
    totalMatchesByPlayer.set(exposure.playerId, matches);

    totalMinutesByPlayer.set(exposure.playerId, (totalMinutesByPlayer.get(exposure.playerId) ?? 0) + exposure.minutesPlayed);

    const positions = positionsByPlayer.get(exposure.playerId) ?? new Set<string>();
    for (const interval of exposure.intervals) {
      if (interval.position !== "BENCH") positions.add(interval.position);
    }
    positionsByPlayer.set(exposure.playerId, positions);
  }

  const goalEventsByPlayer = new Map<string, ContributionEvent[]>();
  const assistEventsByPlayer = new Map<string, ContributionEvent[]>();

  for (const sample of samples) {
    for (const goal of sample.goalEvents) {
      if (goal.team !== "FOR") continue;

      if (goal.scorerPlayerId && realPlayerIds.has(goal.scorerPlayerId)) {
        const list = goalEventsByPlayer.get(goal.scorerPlayerId) ?? [];
        list.push({ matchId: sample.matchId, startsAt: sample.startsAt, matchMs: goal.matchMs, approximateTiming: goal.approximateTiming });
        goalEventsByPlayer.set(goal.scorerPlayerId, list);
      }

      if (goal.assistPlayerId && realPlayerIds.has(goal.assistPlayerId)) {
        const list = assistEventsByPlayer.get(goal.assistPlayerId) ?? [];
        list.push({ matchId: sample.matchId, startsAt: sample.startsAt, matchMs: goal.matchMs, approximateTiming: goal.approximateTiming });
        assistEventsByPlayer.set(goal.assistPlayerId, list);
      }
    }
  }

  const patterns: TeamSeasonPattern[] = [];

  for (const [playerId, events] of goalEventsByPlayer) {
    const exposureByMatch = new Map<string, PlayerMatchExposure>();
    for (const matchId of totalMatchesByPlayer.get(playerId) ?? []) {
      const exposure = exposureByMatchAndPlayer.get(`${matchId}:${playerId}`);
      if (exposure) exposureByMatch.set(matchId, exposure);
    }
    const pattern = buildContributionPattern({
      playerId,
      subtype: "GOAL_CONTRIBUTION",
      events,
      exposureByMatch,
      totalMatches: totalMatchesByPlayer.get(playerId)?.size ?? 0,
      totalMinutes: totalMinutesByPlayer.get(playerId) ?? 0,
      allPositions: [...(positionsByPlayer.get(playerId) ?? [])],
      recentMatchIds,
    });
    if (pattern) patterns.push(pattern);
  }

  for (const [playerId, events] of assistEventsByPlayer) {
    const exposureByMatch = new Map<string, PlayerMatchExposure>();
    for (const matchId of totalMatchesByPlayer.get(playerId) ?? []) {
      const exposure = exposureByMatchAndPlayer.get(`${matchId}:${playerId}`);
      if (exposure) exposureByMatch.set(matchId, exposure);
    }
    const pattern = buildContributionPattern({
      playerId,
      subtype: "ASSIST_CONTRIBUTION",
      events,
      exposureByMatch,
      totalMatches: totalMatchesByPlayer.get(playerId)?.size ?? 0,
      totalMinutes: totalMinutesByPlayer.get(playerId) ?? 0,
      allPositions: [...(positionsByPlayer.get(playerId) ?? [])],
      recentMatchIds,
    });
    if (pattern) patterns.push(pattern);
  }

  return patterns.sort((a, b) => a.key.localeCompare(b.key));
}
