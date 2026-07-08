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

function isValidRating(value: number | null | undefined): value is number {
  return typeof value === "number" && value >= 1 && value <= 5;
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
  const validRatings = ratings.filter((r): r is number => r !== null);

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