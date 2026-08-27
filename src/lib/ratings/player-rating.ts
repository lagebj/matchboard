const RATING_ATTRIBUTE_KEYS = [
  "ballControl",
  "passing",
  "firstTouch",
  "oneVOneAttacking",
  "positioning",
  "oneVOneDefending",
  "decisionMaking",
  "effort",
  "teamplay",
  "concentration",
  "speed",
  "strength",
] as const;

export type RatingAttributeKey = (typeof RATING_ATTRIBUTE_KEYS)[number];

export type PlayerRatingInput = Partial<Record<RatingAttributeKey, number | null>>;

export type RatingSummary = {
  value: number | null;
  displayValue: string;
  ratedAttributeCount: number;
  maxAttributeCount: number;
};

export const RATING_MIN = 1;
export const RATING_MAX = 10;

// A missing rating represents uncertainty, not low ability (AGENTS.md "Player attribute
// ratings": "Missing ratings are treated as uncertainty, not low ability or high ability").
// Any code that must reduce a possibly-null rating to a single number for sorting/scoring
// (rather than excluding it from an average, which is preferred where possible) should fall
// back to this neutral midpoint, never to 0 — 0 makes an unrated player rank below every rated
// player, including a genuine 1/10, which is the opposite of "uncertain" (Phase 9 audit, §63).
export const NEUTRAL_UNRATED_RATING = 5;
export const RATING_SCALE_LABELS: Record<number, string> = {
  1: "Needs support",
  2: "Developing",
  3: "Developing+",
  4: "Steady-",
  5: "Steady",
  6: "Steady+",
  7: "Strong-",
  8: "Strong",
  9: "Standout-",
  10: "Standout",
};

function isValidRating(value: number | null | undefined): value is number {
  return typeof value === "number" && value >= RATING_MIN && value <= RATING_MAX;
}

export function getPlayerOverallRating(
  player: PlayerRatingInput,
): RatingSummary {
  const values = RATING_ATTRIBUTE_KEYS
    .map((key) => player[key])
    .filter(isValidRating);

  if (values.length === 0) {
    return {
      value: null,
      displayValue: "Not rated",
      ratedAttributeCount: 0,
      maxAttributeCount: RATING_ATTRIBUTE_KEYS.length,
    };
  }

  const total = values.reduce((sum, v) => sum + v, 0);
  const avg = total / values.length;

  return {
    value: Math.round(avg * 10) / 10,
    displayValue: avg.toFixed(1),
    ratedAttributeCount: values.length,
    maxAttributeCount: RATING_ATTRIBUTE_KEYS.length,
  };
}

export function getAverageRating(ratings: Array<number | null>): RatingSummary {
  const validRatings = ratings.filter((r): r is number => r !== null && r >= RATING_MIN && r <= RATING_MAX);

  if (validRatings.length === 0) {
    return {
      value: null,
      displayValue: "Not rated",
      ratedAttributeCount: 0,
      maxAttributeCount: RATING_ATTRIBUTE_KEYS.length,
    };
  }

  const total = validRatings.reduce((sum, v) => sum + v, 0);
  const avg = total / validRatings.length;

  return {
    value: Math.round(avg * 10) / 10,
    displayValue: avg.toFixed(1),
    ratedAttributeCount: validRatings.length,
    maxAttributeCount: RATING_ATTRIBUTE_KEYS.length,
  };
}

// Player attributes use a 1-10 scale; the visual star representation uses a 0-5 scale with
// half-star support. Invalid/out-of-range values are clamped to the supported 1-10 range rather
// than producing an out-of-range or NaN star value (a rating of 0 must not become "0 stars" —
// AGENTS.md "Player attribute ratings": missing/invalid data is uncertainty, not a real score,
// but this function only ever receives an already-resolved numeric rating; null handling belongs
// to the caller, same as getPlayerOverallRating's own null branch).
export function overallToStarValue(overall: number): number {
  if (!Number.isFinite(overall)) return 0;
  const clamped = Math.max(RATING_MIN, Math.min(RATING_MAX, overall));
  return clamped / 2;
}

// The single centralized rating-to-star conversion. Every star-rating UI in the app must go
// through this (directly or via overallToStarValue) rather than re-deriving its own rounding —
// a prior duplicate in player-metrics.ts rounded the raw 1-10 value as if it were already on a
// 0-5 scale (Math.round(overall), clamped to 5), which is why a 5.6 average rendered as 5 stars
// instead of 3. Rounds to the nearest half star (e.g. 2.8 -> 3.0, 2.4 -> 2.5).
export function roundToNearestHalfStar(overall: number): number {
  return Math.round(overallToStarValue(overall) * 2) / 2;
}

export function formatStarDisplay(overall: number): string {
  const rounded = roundToNearestHalfStar(overall);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}
