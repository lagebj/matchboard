import { calculateEncounterEstimate, FORMULA_VERSION } from "@/lib/opponents/sporting-level-calculation";
import type { PlayerPositionInterval } from "@/lib/live-match/live-match-types";

export const OPPONENT_ENGINE_VERSION = "1.0.0";

export type DataQualityTier = "A" | "B" | "C" | "D";

export type LineupStateInterval = {
  startedAtMs: number;
  endedAtMs: number | null;
  playerIds: string[];
  positionMap: Map<string, string>;
  goalsFor: number;
  goalsAgainst: number;
};

export type EffectivePlayerStrength = {
  playerId: string;
  overallRating: number;
  position: string;
  positionSuitability: number;
  effectiveStrength: number;
  minutesPlayed: number | null;
};

export type LineupStateStrength = {
  startedAtMs: number;
  endedAtMs: number | null;
  durationMs: number;
  effectiveStrength: number;
  weightedGoalsFor: number;
  weightedGoalsAgainst: number;
  playerCount: number;
  dataQuality: DataQualityTier;
};

export type OpponentEncounterEvidenceInput = {
  matchId: string;
  opponentTeamId: string;
  occurredAt: Date;
  gameFormat: string | null;
  goalsFor: number;
  goalsAgainst: number;
  matchFit: string | null;
  matchEnvironment: string | null;
  lineupStates: LineupStateStrength[];
  fieldedRatingSnapshot: number | null;
  weightingMethod: "MINUTE_WEIGHTED" | "PARTICIPANT_AVERAGE";
  participantCount: number;
  ratedParticipantCount: number;
};

export type OpponentEncounterEvidenceResult = {
  estimate: number;
  formulaVersion: string;
  engineVersion: string;
  dataQuality: DataQualityTier;
  confidence: "unknown" | "low" | "medium" | "high";
  lineupStateCount: number;
  dominantLineupStrength: number | null;
  contextSignals: OpponentContextSignal[];
};

export type OpponentContextSignal = {
  type: "match_environment" | "match_fit" | "data_quality" | "lineup_state_variability";
  value: string;
  influence: "supporting" | "context" | "suppressed";
};

export type HistoricalDryRunResult = {
  matchesInspected: number;
  matchesEligible: number;
  exclusions: Array<{ matchId: string; reason: string }>;
  evidenceCreated: number;
  evidenceSkipped: number;
  opponentsAffected: number;
  playerMutations: number;
  playerPositionMutations: number;
  historicalFactChanges: number;
  details: Array<{
    matchId: string;
    opponentTeamId: string;
    previousEstimate: number | null;
    proposedEstimate: number;
    dataQuality: DataQualityTier;
    confidence: string;
    difference: number;
  }>;
  /** League/Event breakdown (ADR-0104 -- Populate opponent levels now covers both). */
  bySource: {
    league: { inspected: number; eligible: number };
    event: { inspected: number; eligible: number };
  };
};

const POSITION_SUITABILITY_MODERATE = 0.85;
const POSITION_SUITABILITY_LOW = 0.7;
const POSITION_SUITABILITY_UNSUITED = 0.55;

export function classifyDataQuality(params: {
  hasExactTimeline: boolean;
  hasReliableMinutes: boolean;
  hasReliablePositions: boolean;
  participantCount: number;
  ratedParticipantCount: number;
}): DataQualityTier {
  const { hasExactTimeline, hasReliableMinutes, hasReliablePositions, participantCount, ratedParticipantCount } = params;

  if (hasExactTimeline && hasReliablePositions && participantCount > 0 && ratedParticipantCount >= Math.ceil(participantCount * 0.5)) {
    return "A";
  }

  if (hasReliableMinutes && hasReliablePositions && participantCount > 0 && ratedParticipantCount >= Math.ceil(participantCount * 0.3)) {
    return "B";
  }

  if (participantCount > 0 && ratedParticipantCount > 0) {
    return "C";
  }

  return "D";
}

export function computePositionSuitability(
  primaryPosition: string | null,
  secondaryPosition: string | null,
  tertiaryPosition: string | null,
  playedPosition: string,
): number {
  if (!primaryPosition) return POSITION_SUITABILITY_LOW;

  const normalizedPlayed = playedPosition.toLowerCase().trim();
  const normalizedPrimary = primaryPosition.toLowerCase().trim();
  const normalizedSecondary = secondaryPosition?.toLowerCase().trim() ?? "";
  const normalizedTertiary = tertiaryPosition?.toLowerCase().trim() ?? "";

  if (normalizedPrimary === normalizedPlayed) return 1.0;
  if (normalizedSecondary === normalizedPlayed) return POSITION_SUITABILITY_MODERATE;
  if (normalizedTertiary === normalizedPlayed) return POSITION_SUITABILITY_LOW;

  return POSITION_SUITABILITY_UNSUITED;
}

export function computeEffectivePlayerStrength(params: {
  overallRating: number | null;
  positionSuitability: number;
}): number {
  const { overallRating, positionSuitability } = params;

  if (overallRating === null) {
    return 5.0 * positionSuitability;
  }

  return overallRating * positionSuitability;
}

export function computeLineupStateStrengths(
  positionIntervals: PlayerPositionInterval[],
  goalTimes: Array<{ ms: number; forUs: boolean }>,
  players: Array<{
    playerId: string;
    overallRating: number | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
  }>,
  matchEndMs: number,
): LineupStateStrength[] {
  if (positionIntervals.length === 0) {
    return [];
  }

  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  const sortedIntervals = [...positionIntervals]
    .filter((i) => i.position !== "BENCH")
    .sort((a, b) => a.startedAtMs - b.startedAtMs);

  if (sortedIntervals.length === 0) {
    return [];
  }

  const stateBoundaries = new Set<number>();
  stateBoundaries.add(0);
  for (const interval of sortedIntervals) {
    stateBoundaries.add(interval.startedAtMs);
    if (interval.endedAtMs !== null) {
      stateBoundaries.add(interval.endedAtMs);
    }
  }
  stateBoundaries.add(matchEndMs);
  const boundaries = [...stateBoundaries].sort((a, b) => a - b);

  const states: LineupStateStrength[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMs = boundaries[i];
    const endMs = boundaries[i + 1];
    const durationMs = endMs - startMs;

    if (durationMs <= 0) continue;

    const activePlayers: EffectivePlayerStrength[] = [];

    for (const interval of sortedIntervals) {
      const intervalStart = interval.startedAtMs;
      const intervalEnd = interval.endedAtMs ?? matchEndMs;

      if (intervalStart < endMs && intervalEnd > startMs) {
        const player = playerMap.get(interval.playerId);
        if (!player) continue;

        const suitability = computePositionSuitability(
          player.primaryPosition,
          player.secondaryPosition,
          player.tertiaryPosition,
          interval.position,
        );

        const effective = computeEffectivePlayerStrength({
          overallRating: player.overallRating,
          positionSuitability: suitability,
        });

        activePlayers.push({
          playerId: interval.playerId,
          overallRating: player.overallRating ?? 5.0,
          position: interval.position,
          positionSuitability: suitability,
          effectiveStrength: effective,
          minutesPlayed: null,
        });
      }
    }

    if (activePlayers.length === 0) continue;

    const totalStrength = activePlayers.reduce((sum, p) => sum + p.effectiveStrength, 0);
    const averageStrength = totalStrength / activePlayers.length;

    const goalsInInterval = goalTimes.filter(
      (g) => g.ms >= startMs && g.ms < endMs,
    );
    const goalsFor = goalsInInterval.filter((g) => g.forUs).length;
    const goalsAgainst = goalsInInterval.filter((g) => !g.forUs).length;

    states.push({
      startedAtMs: startMs,
      endedAtMs: endMs,
      durationMs,
      effectiveStrength: Math.round(averageStrength * 100) / 100,
      weightedGoalsFor: goalsFor,
      weightedGoalsAgainst: goalsAgainst,
      playerCount: activePlayers.length,
      dataQuality: "A",
    });
  }

  return states;
}

export function computeEncounterEvidenceFromLineupStates(
  lineupStates: LineupStateStrength[],
  fieldedRatingSnapshot: number | null,
  goalsFor: number,
  goalsAgainst: number,
  dataQuality: DataQualityTier,
  matchEnvironment: string | null,
  matchFit: string | null,
): OpponentEncounterEvidenceResult {
  if (dataQuality === "D") {
    return {
      estimate: fieldedRatingSnapshot ?? 5.0,
      formulaVersion: FORMULA_VERSION,
      engineVersion: OPPONENT_ENGINE_VERSION,
      dataQuality: "D",
      confidence: "unknown",
      lineupStateCount: 0,
      dominantLineupStrength: null,
      contextSignals: [
        { type: "data_quality", value: "insufficient_participation_data", influence: "suppressed" },
      ],
    };
  }

  if (lineupStates.length === 0 || fieldedRatingSnapshot === null) {
    const estimate = calculateEncounterEstimate(
      fieldedRatingSnapshot ?? 5.0,
      goalsFor,
      goalsAgainst,
    );

    return {
      estimate: Math.round(estimate * 100) / 100,
      formulaVersion: FORMULA_VERSION,
      engineVersion: OPPONENT_ENGINE_VERSION,
      dataQuality,
      confidence: dataQuality === "C" ? "low" : "medium",
      lineupStateCount: 0,
      dominantLineupStrength: null,
      contextSignals: buildContextSignals(matchEnvironment, matchFit, dataQuality),
    };
  }

  const totalDurationMs = lineupStates.reduce((sum, s) => sum + s.durationMs, 0);
  const dominantState = lineupStates.reduce((prev, curr) =>
    curr.durationMs > prev.durationMs ? curr : prev,
  );

  const hasPerStateGoals = lineupStates.some(
    (s) => s.weightedGoalsFor > 0 || s.weightedGoalsAgainst > 0,
  );

  const perStateEstimates = lineupStates.map((state) => {
    const durationWeight = state.durationMs / totalDurationMs;

    const stateGoalsFor = hasPerStateGoals
      ? state.weightedGoalsFor
      : goalsFor * durationWeight;
    const stateGoalsAgainst = hasPerStateGoals
      ? state.weightedGoalsAgainst
      : goalsAgainst * durationWeight;

    const stateEstimate = calculateEncounterEstimate(
      state.effectiveStrength,
      stateGoalsFor,
      stateGoalsAgainst,
    );
    return {
      estimate: stateEstimate,
      durationWeight,
      totalGoals: stateGoalsFor + stateGoalsAgainst,
    };
  });

  const totalGoalsAcrossStates = perStateEstimates.reduce(
    (sum, e) => sum + e.totalGoals,
    0,
  );

  let blendedEstimate: number;

  if (totalGoalsAcrossStates === 0) {
    blendedEstimate = perStateEstimates.reduce(
      (sum, e) => sum + e.estimate * e.durationWeight,
      0,
    );
  } else {
    const significanceWeights = perStateEstimates.map((e) => {
      const goalSignificance = e.totalGoals > 0
        ? 1 + e.totalGoals / totalGoalsAcrossStates
        : 0.5;
      return e.durationWeight * goalSignificance;
    });
    const totalWeight = significanceWeights.reduce((sum, w) => sum + w, 0);
    blendedEstimate = perStateEstimates.reduce(
      (sum, e, i) => sum + e.estimate * significanceWeights[i],
      0,
    ) / totalWeight;
  }

  const contextSignals = buildContextSignals(matchEnvironment, matchFit, dataQuality);

  if (lineupStates.length > 1) {
    const strengthRange = lineupStates.reduce(
      (acc, s) => ({
        min: Math.min(acc.min, s.effectiveStrength),
        max: Math.max(acc.max, s.effectiveStrength),
      }),
      { min: Infinity, max: -Infinity },
    );
    const variability = strengthRange.max - strengthRange.min;

    if (variability > 2.0) {
      contextSignals.push({
        type: "lineup_state_variability",
        value: `lineup_strength_range_${variability.toFixed(1)}`,
        influence: "context",
      });
    }
  }

  return {
    estimate: Math.round(blendedEstimate * 100) / 100,
    formulaVersion: FORMULA_VERSION,
    engineVersion: OPPONENT_ENGINE_VERSION,
    dataQuality,
    confidence: classifyConfidence(lineupStates.length, dataQuality),
    lineupStateCount: lineupStates.length,
    dominantLineupStrength: Math.round(dominantState.effectiveStrength * 100) / 100,
    contextSignals,
  };
}

function classifyConfidence(
  lineupStateCount: number,
  dataQuality: DataQualityTier,
): "unknown" | "low" | "medium" | "high" {
  if (dataQuality === "D") return "unknown";
  if (dataQuality === "C") return "low";
  if (lineupStateCount <= 1) return "medium";
  return "high";
}

function buildContextSignals(
  matchEnvironment: string | null,
  matchFit: string | null,
  dataQuality: DataQualityTier,
): OpponentContextSignal[] {
  const signals: OpponentContextSignal[] = [];

  if (matchEnvironment && matchEnvironment !== "NOT_ASSESSED") {
    signals.push({
      type: "match_environment",
      value: matchEnvironment,
      influence: "context",
    });
  }

  if (matchFit && matchFit !== "UNKNOWN" && matchFit !== "GOOD_FIT") {
    signals.push({
      type: "match_fit",
      value: matchFit,
      influence: "supporting",
    });
  }

  if (dataQuality === "B" || dataQuality === "C") {
    signals.push({
      type: "data_quality",
      value: `tier_${dataQuality}`,
      influence: dataQuality === "B" ? "context" : "suppressed",
    });
  }

  return signals;
}

export function computeWholeMatchEstimate(
  fieldedRating: number | null,
  goalsFor: number,
  goalsAgainst: number,
  participantCount: number,
  ratedParticipantCount: number,
  matchFit: string | null,
  dataQuality: DataQualityTier,
  matchEnvironment: string | null,
): OpponentEncounterEvidenceResult {
  if (fieldedRating === null) {
    return {
      estimate: 5.0,
      formulaVersion: FORMULA_VERSION,
      engineVersion: OPPONENT_ENGINE_VERSION,
      dataQuality: dataQuality === "A" ? "B" : dataQuality,
      confidence: "unknown",
      lineupStateCount: 0,
      dominantLineupStrength: null,
      contextSignals: buildContextSignals(matchEnvironment, matchFit, dataQuality === "A" ? "B" : dataQuality),
    };
  }

  const estimate = calculateEncounterEstimate(fieldedRating, goalsFor, goalsAgainst);

  const effectiveDataQuality: DataQualityTier = dataQuality === "A" ? "B" : dataQuality;

  return {
    estimate: Math.round(estimate * 100) / 100,
    formulaVersion: FORMULA_VERSION,
    engineVersion: OPPONENT_ENGINE_VERSION,
    dataQuality: effectiveDataQuality,
    confidence: classifyConfidence(0, effectiveDataQuality),
    lineupStateCount: 0,
    dominantLineupStrength: Math.round(fieldedRating * 100) / 100,
    contextSignals: buildContextSignals(matchEnvironment, matchFit, effectiveDataQuality),
  };
}