import { getOverallStarRating } from "@/lib/player-metrics";

export type LineupRatingResult = {
  averageRating: number | null;
  starRating: number;
  ratedStarterCount: number;
  totalStarterCount: number;
  totalSlots: number;
  isProvisional: boolean;
};

export function computeLineupRating(
  starters: Array<{ overallLevel: number | null }>,
  totalSlots: number,
): LineupRatingResult {
  const totalStarterCount = starters.length;
  const ratedStarters = starters.filter(
    (s) => s.overallLevel !== null && s.overallLevel !== undefined,
  );
  const ratedStarterCount = ratedStarters.length;

  if (ratedStarterCount === 0) {
    return {
      averageRating: null,
      starRating: 0,
      ratedStarterCount: 0,
      totalStarterCount,
      totalSlots,
      isProvisional: totalStarterCount < totalSlots,
    };
  }

  const ratingValues = ratedStarters.map((s) => s.overallLevel as number);
  const averageRating =
    Math.round((ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length) * 10) / 10;

  return {
    averageRating,
    starRating: getOverallStarRating(averageRating),
    ratedStarterCount,
    totalStarterCount,
    totalSlots,
    isProvisional: totalStarterCount < totalSlots || ratedStarterCount < totalStarterCount,
  };
}

export function formatStarRating(starRating: number): string {
  if (starRating <= 0) return "";
  const full = Math.floor(starRating);
  const hasHalf = starRating % 1 >= 0.5;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("\u2605");
  if (hasHalf) stars.push("\u00BD");
  return stars.join("");
}

export function formatLineupRatingLabel(result: LineupRatingResult): string {
  if (result.averageRating === null) {
    return "Not rated";
  }

  const rating = result.averageRating.toFixed(1);
  const count = `${result.ratedStarterCount}/${result.totalSlots}`;

  if (result.isProvisional) {
    return `${result.starRating} stars ${rating} \u00B7 ${count} rated \u00B7 Provisional`;
  }

  return `${result.starRating} stars ${rating} \u00B7 ${count} rated`;
}