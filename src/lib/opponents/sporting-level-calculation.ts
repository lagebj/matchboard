export const FORMULA_VERSION = "v1";

export const ADJUSTMENT_SCALE_5 = 0.9;
export const ADJUSTMENT_CAP_5 = 2.25;
export const ESTIMATE_MIN_5 = 1.0;
export const ESTIMATE_MAX_5 = 5.0;

export const ESTIMATE_MIN_10 = 2.0;
export const ESTIMATE_MAX_10 = 10.0;

export const ADJUSTMENT_SCALE_10 = 1.8;
export const ADJUSTMENT_CAP_10 = 4.5;

export function calculateEncounterEstimate5(
  fieldedRating5: number,
  goalsFor: number,
  goalsAgainst: number,
): number {
  const rawAdjustment = ADJUSTMENT_SCALE_5 * Math.log((goalsFor + 1.5) / (goalsAgainst + 1.5));
  const adjustment = Math.max(-ADJUSTMENT_CAP_5, Math.min(ADJUSTMENT_CAP_5, rawAdjustment));
  const estimate5 = fieldedRating5 - adjustment;
  return Math.max(ESTIMATE_MIN_5, Math.min(ESTIMATE_MAX_5, estimate5));
}

export function calculateEncounterEstimate(
  fieldedRating10: number,
  goalsFor: number,
  goalsAgainst: number,
): number {
  const fielded5 = fieldedRating10 / 2;
  const estimate5 = calculateEncounterEstimate5(fielded5, goalsFor, goalsAgainst);
  return estimate5 * 2;
}

export type EncounterEstimateResult = {
  estimate: number;
  formulaVersion: string;
  fieldedRatingSnapshot: number;
  goalsFor: number;
  goalsAgainst: number;
};

export function calculateEncounterEstimateDetailed(
  fieldedRating10: number,
  goalsFor: number,
  goalsAgainst: number,
): EncounterEstimateResult {
  const estimate = calculateEncounterEstimate(fieldedRating10, goalsFor, goalsAgainst);
  return {
    estimate: Math.round(estimate * 100) / 100,
    formulaVersion: FORMULA_VERSION,
    fieldedRatingSnapshot: fieldedRating10,
    goalsFor,
    goalsAgainst,
  };
}

export function computeFieldedRating(
  players: Array<{ rating: number | null; minutes?: number | null }>,
): { rating: number | null; method: "MINUTE_WEIGHTED" | "PARTICIPANT_AVERAGE"; participantCount: number; ratedParticipantCount: number } {
  const withRatings = players.filter((p) => p.rating !== null && p.rating >= 1 && p.rating <= 10);
  if (withRatings.length === 0) {
    return { rating: null, method: "PARTICIPANT_AVERAGE", participantCount: players.length, ratedParticipantCount: 0 };
  }

  const withMinutes = withRatings.filter((p) => p.minutes != null && p.minutes > 0);
  if (withMinutes.length >= Math.ceil(withRatings.length * 0.5)) {
    const totalWeighted = withMinutes.reduce((sum, p) => sum + p.rating! * p.minutes!, 0);
    const totalMinutes = withMinutes.reduce((sum, p) => sum + p.minutes!, 0);
    return {
      rating: Math.round((totalWeighted / totalMinutes) * 100) / 100,
      method: "MINUTE_WEIGHTED",
      participantCount: players.length,
      ratedParticipantCount: withRatings.length,
    };
  }

  const totalRating = withRatings.reduce((sum, p) => sum + p.rating!, 0);
  return {
    rating: Math.round((totalRating / withRatings.length) * 100) / 100,
    method: "PARTICIPANT_AVERAGE",
    participantCount: players.length,
    ratedParticipantCount: withRatings.length,
  };
}

export const AUTO_EXCLUDE_MATCH_FIT = new Set(["CHAOTIC", "SUPPORT_OVERPOWERED", "SUPPORT_TOO_LOW"]);

export function shouldAutoExcludeEncounter(matchFit: string | null): boolean {
  return matchFit != null && AUTO_EXCLUDE_MATCH_FIT.has(matchFit);
}