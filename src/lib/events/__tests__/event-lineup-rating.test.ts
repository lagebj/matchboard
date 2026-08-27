import { describe, it, expect } from "vitest";
import {
  computeLineupRating,
  formatStarRating,
  formatLineupRatingLabel,
} from "../event-lineup-rating";

describe("computeLineupRating", () => {
  it("returns null average and 0 stars when no starters have ratings", () => {
    const result = computeLineupRating(
      [
        { overallLevel: null },
        { overallLevel: null },
      ],
      7,
    );
    expect(result.averageRating).toBeNull();
    expect(result.starRating).toBe(0);
    expect(result.ratedStarterCount).toBe(0);
    expect(result.totalStarterCount).toBe(2);
    expect(result.totalSlots).toBe(7);
    expect(result.isProvisional).toBe(true);
  });

  it("computes average from rated starters only", () => {
    const result = computeLineupRating(
      [
        { overallLevel: 4.0 },
        { overallLevel: 3.0 },
        { overallLevel: null },
      ],
      7,
    );
    expect(result.averageRating).toBe(3.5);
    // 3.5 on the 1-10 scale is 1.75 stars, rounded to the nearest half star -> 2.0.
    expect(result.starRating).toBe(2);
    expect(result.ratedStarterCount).toBe(2);
    expect(result.totalStarterCount).toBe(3);
    expect(result.isProvisional).toBe(true);
  });

  it("returns non-provisional when all slots filled and all rated", () => {
    const result = computeLineupRating(
      [
        { overallLevel: 4.0 },
        { overallLevel: 3.5 },
        { overallLevel: 3.0 },
      ],
      3,
    );
    expect(result.averageRating).toBe(3.5);
    expect(result.starRating).toBe(2);
    expect(result.ratedStarterCount).toBe(3);
    expect(result.totalStarterCount).toBe(3);
    expect(result.totalSlots).toBe(3);
    expect(result.isProvisional).toBe(false);
  });

  it("marks provisional when not all slots filled", () => {
    const result = computeLineupRating(
      [{ overallLevel: 4.0 }],
      7,
    );
    expect(result.isProvisional).toBe(true);
    expect(result.totalStarterCount).toBe(1);
    expect(result.totalSlots).toBe(7);
  });

  it("marks provisional when some starters are unrated", () => {
    const result = computeLineupRating(
      [
        { overallLevel: 4.0 },
        { overallLevel: null },
      ],
      2,
    );
    expect(result.isProvisional).toBe(true);
    expect(result.ratedStarterCount).toBe(1);
    expect(result.totalStarterCount).toBe(2);
  });

  it("rounds average to 1 decimal place", () => {
    const result = computeLineupRating(
      [
        { overallLevel: 3 },
        { overallLevel: 4 },
        { overallLevel: 3 },
      ],
      3,
    );
    expect(result.averageRating).toBe(3.3);
  });

  it("returns 0 stars for null average", () => {
    const result = computeLineupRating([], 7);
    expect(result.starRating).toBe(0);
    expect(result.averageRating).toBeNull();
  });

  it("handles single rated starter", () => {
    const result = computeLineupRating(
      [{ overallLevel: 3.7 }],
      5,
    );
    expect(result.averageRating).toBe(3.7);
    // 3.7 on the 1-10 scale is 1.85 stars, rounded to the nearest half star -> 2.0.
    expect(result.starRating).toBe(2);
  });
});

describe("formatStarRating", () => {
  it("returns empty string for 0 stars", () => {
    expect(formatStarRating(0)).toBe("");
  });

  it("returns full stars for whole numbers", () => {
    expect(formatStarRating(3)).toBe("\u2605\u2605\u2605");
  });

  it("returns half star for 3.5", () => {
    expect(formatStarRating(3.5)).toBe("\u2605\u2605\u2605\u00BD");
  });

  it("rounds to nearest 0.5", () => {
    expect(formatStarRating(4)).toBe("\u2605\u2605\u2605\u2605");
  });
});

describe("formatLineupRatingLabel", () => {
  it("shows Not rated for null average", () => {
    const result = computeLineupRating(
      [{ overallLevel: null }],
      7,
    );
    expect(formatLineupRatingLabel(result)).toBe("Not rated");
  });

  it("includes provisional label for incomplete lineups", () => {
    const result = computeLineupRating(
      [{ overallLevel: 4.0 }],
      7,
    );
    const label = formatLineupRatingLabel(result);
    expect(label).toContain("Provisional");
  });

  it("shows rating and count for complete lineups", () => {
    const result = computeLineupRating(
      [
        { overallLevel: 4.0 },
        { overallLevel: 3.5 },
        { overallLevel: 3.0 },
      ],
      3,
    );
    const label = formatLineupRatingLabel(result);
    expect(label).not.toContain("Provisional");
    expect(label).toContain("3/3 rated");
  });
});