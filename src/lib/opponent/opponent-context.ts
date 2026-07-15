import {
  DEFAULT_CHALLENGE_MARGIN,
  MAX_SPORTING_LEVEL,
  type OpponentSportingEstimate,
} from "./opponent-estimate";

export type OpponentContextInfluence =
  | "opponent_level_target"
  | "lower_opponent_development_opportunity"
  | "higher_opponent_stability_preference"
  | "difficult_environment_advisory"
  | "opponent_context_not_applicable";

export interface OpponentContextResult {
  influence: OpponentContextInfluence;
  suggestedMinimumLevel: number;
  challengeMargin: number;
  opponentLevel: number;
  explanation: string;
  isHardBlock: false;
  isScoringPreference: true;
}

export function calculateOpponentContextForMatch(
  opponentEstimate: OpponentSportingEstimate | null,
  hasDifficultEnvironment: boolean,
  opponentTeamName: string,
): OpponentContextResult | null {
  if (!opponentEstimate || opponentEstimate.assessmentCount === 0) {
    if (hasDifficultEnvironment) {
      return {
        influence: "difficult_environment_advisory",
        suggestedMinimumLevel: 0,
        challengeMargin: 0,
        opponentLevel: 0,
        explanation: `Previous encounter against ${opponentTeamName || "opponent"} included difficult match-environment observations. Consider players with strong composure and reset behaviour.`,
        isHardBlock: false,
        isScoringPreference: true,
      };
    }
    return null;
  }

  const suggestedMinimum = Math.min(
    opponentEstimate.estimatedLevel + DEFAULT_CHALLENGE_MARGIN,
    MAX_SPORTING_LEVEL,
  );

  if (hasDifficultEnvironment) {
    return {
      influence: "difficult_environment_advisory",
      suggestedMinimumLevel: suggestedMinimum,
      challengeMargin: DEFAULT_CHALLENGE_MARGIN,
      opponentLevel: opponentEstimate.estimatedLevel,
      explanation: `Opponent ${opponentTeamName} estimated at ${opponentEstimate.estimatedLevel.toFixed(1)} with previous difficult environment. Suggested minimum squad strength: ${suggestedMinimum.toFixed(1)}. Consider players with strong composure under pressure.`,
      isHardBlock: false,
      isScoringPreference: true,
    };
  }

  if (opponentEstimate.estimatedLevel <= 2.5) {
    return {
      influence: "lower_opponent_development_opportunity",
      suggestedMinimumLevel: suggestedMinimum,
      challengeMargin: DEFAULT_CHALLENGE_MARGIN,
      opponentLevel: opponentEstimate.estimatedLevel,
      explanation: `Opponent ${opponentTeamName} estimated at ${opponentEstimate.estimatedLevel.toFixed(1)} — lower level. Suggested minimum: ${suggestedMinimum.toFixed(1)}. Increase development opportunities for eligible players while meeting squad function.`,
      isHardBlock: false,
      isScoringPreference: true,
    };
  }

  if (opponentEstimate.estimatedLevel >= 3.8) {
    return {
      influence: "higher_opponent_stability_preference",
      suggestedMinimumLevel: suggestedMinimum,
      challengeMargin: DEFAULT_CHALLENGE_MARGIN,
      opponentLevel: opponentEstimate.estimatedLevel,
      explanation: `Opponent ${opponentTeamName} estimated at ${opponentEstimate.estimatedLevel.toFixed(1)} — higher level. Suggested minimum: ${suggestedMinimum.toFixed(1)}. Consider eligible established and stabilising players while retaining development opportunities.`,
      isHardBlock: false,
      isScoringPreference: true,
    };
  }

  return {
    influence: "opponent_level_target",
    suggestedMinimumLevel: suggestedMinimum,
    challengeMargin: DEFAULT_CHALLENGE_MARGIN,
    opponentLevel: opponentEstimate.estimatedLevel,
    explanation: `Opponent ${opponentTeamName} estimated at ${opponentEstimate.estimatedLevel.toFixed(1)}. Suggested minimum squad strength: ${suggestedMinimum.toFixed(1)}.`,
    isHardBlock: false,
    isScoringPreference: true,
  };
}

export function opponentContextScoringAdjustment(
  opponentEstimate: OpponentSportingEstimate | null,
  playerReadinessScore: number,
  isDevelopmentCandidate: boolean,
): number {
  if (!opponentEstimate || opponentEstimate.assessmentCount === 0) return 0;

  const adjustment: number = 0;

  if (opponentEstimate.estimatedLevel >= 3.8 && !isDevelopmentCandidate) {
    return Math.min(playerReadinessScore * 0.5, 3);
  }

  if (opponentEstimate.estimatedLevel <= 2.5 && isDevelopmentCandidate) {
    return 2;
  }

  return adjustment;
}

export const OPPONENT_CONTEXT_HARD_BOUNDARIES = [
  "Opponent level must not make an ineligible player eligible",
  "Opponent level must not exclude an otherwise eligible player",
  "Opponent level must not bypass rotation paths",
  "Opponent level must not override availability",
  "Opponent level must not override same-round uniqueness",
  "Opponent level must not override squad minimums or core invariants",
  "Opponent level must not silently override coach judgement",
  "Opponent level must not mutate finalised history",
  "Opponent level must not create a public or parent-visible player ranking",
] as const;