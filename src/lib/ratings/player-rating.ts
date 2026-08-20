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

export function overallToStarValue(overall: number): number {
  return overall / 2;
}

export function formatStarDisplay(overall: number): string {
  const starValue = overallToStarValue(overall);
  const whole = Math.floor(starValue);
  const half = starValue - whole >= 0.25 && starValue - whole < 0.75;
  const displayWhole = half ? whole : (starValue - whole >= 0.75 ? whole + 1 : whole);
  if (half) return `${displayWhole}.5`;
  return `${displayWhole}`;
}