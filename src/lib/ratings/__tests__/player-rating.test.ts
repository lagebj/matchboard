import { describe, it, expect } from "vitest";
import { getPlayerOverallRating, getAverageRating, overallToStarValue, RATING_MIN, RATING_MAX } from "../player-rating";

describe("getPlayerOverallRating", () => {
  it("returns Not rated when all attributes are null", () => {
    const result = getPlayerOverallRating({
      ballControl: null,
      passing: null,
      firstTouch: null,
      oneVOneAttacking: null,
      positioning: null,
      oneVOneDefending: null,
      decisionMaking: null,
      effort: null,
      teamplay: null,
      concentration: null,
      speed: null,
      strength: null,
    });

    expect(result.value).toBeNull();
    expect(result.displayValue).toBe("Not rated");
    expect(result.ratedAttributeCount).toBe(0);
    expect(result.maxAttributeCount).toBe(12);
  });

  it("returns Not rated when no attributes are provided", () => {
    const result = getPlayerOverallRating({});

    expect(result.value).toBeNull();
    expect(result.displayValue).toBe("Not rated");
    expect(result.ratedAttributeCount).toBe(0);
  });

  it("calculates average of all valid attributes on 1-10 scale", () => {
    const result = getPlayerOverallRating({
      ballControl: 6,
      passing: 8,
      firstTouch: 6,
      oneVOneAttacking: 4,
      positioning: 8,
      oneVOneDefending: 6,
      decisionMaking: 10,
      effort: 6,
      teamplay: 8,
      concentration: 4,
      speed: 6,
      strength: 8,
    });

    expect(result.value).toBeCloseTo(6.7, 1);
    expect(result.ratedAttributeCount).toBe(12);
  });

  it("excludes null attributes from the average", () => {
    const result = getPlayerOverallRating({
      ballControl: 6,
      passing: null,
      firstTouch: 6,
      oneVOneAttacking: null,
      positioning: 6,
      oneVOneDefending: null,
      decisionMaking: 6,
      effort: null,
      teamplay: null,
      concentration: null,
      speed: null,
      strength: null,
    });

    expect(result.value).toBe(6.0);
    expect(result.ratedAttributeCount).toBe(4);
  });

  it("treats 0 as unrated, not as a low score", () => {
    const result = getPlayerOverallRating({
      ballControl: 0,
      passing: 6,
    });

    expect(result.ratedAttributeCount).toBe(1);
    expect(result.value).toBe(6.0);
  });

  it("rounds display value to one decimal", () => {
    const result = getPlayerOverallRating({
      ballControl: 6,
      passing: 8,
      firstTouch: 6,
    });

    const sum = 6 + 8 + 6;
    const expected = Math.round((sum / 3) * 10) / 10;
    expect(result.value).toBe(expected);
    expect(result.displayValue).toBe(expected.toFixed(1));
  });

  it("works with a single rated attribute", () => {
    const result = getPlayerOverallRating({ effort: 8 });

    expect(result.value).toBe(8.0);
    expect(result.displayValue).toBe("8.0");
    expect(result.ratedAttributeCount).toBe(1);
  });

  it("accepts values on 1-10 scale", () => {
    const result = getPlayerOverallRating({
      ballControl: 1,
      passing: 5,
      effort: 10,
    });

    expect(result.ratedAttributeCount).toBe(3);
    expect(result.value).toBeCloseTo(5.3, 1);
  });

  it("rejects values outside 1-10 range", () => {
    const result = getPlayerOverallRating({
      ballControl: 11,
      passing: 6,
      effort: -1,
    });

    expect(result.ratedAttributeCount).toBe(1);
    expect(result.value).toBe(6.0);
  });

  it("RATING_MIN is 1 and RATING_MAX is 10", () => {
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(10);
  });
});

describe("overallToStarValue", () => {
  it("converts 10 to 5 stars", () => {
    expect(overallToStarValue(10)).toBe(5);
  });

  it("converts 2 to 1 star", () => {
    expect(overallToStarValue(2)).toBe(1);
  });

  it("converts 6 to 3 stars", () => {
    expect(overallToStarValue(6)).toBe(3);
  });

  it("converts 7 to 3.5 stars", () => {
    expect(overallToStarValue(7)).toBe(3.5);
  });

  it("converts 1 to 0.5 stars", () => {
    expect(overallToStarValue(1)).toBe(0.5);
  });
});

describe("getAverageRating", () => {
  it("returns Not rated for empty array", () => {
    const result = getAverageRating([]);
    expect(result.value).toBeNull();
    expect(result.displayValue).toBe("Not rated");
  });

  it("returns Not rated for array of nulls", () => {
    const result = getAverageRating([null, null, null]);
    expect(result.value).toBeNull();
    expect(result.displayValue).toBe("Not rated");
  });

  it("calculates average excluding nulls", () => {
    const result = getAverageRating([6.4, null, 8.2, null, 5.6]);
    expect(result.value).toBeCloseTo(6.7, 1);
    expect(result.ratedAttributeCount).toBe(3);
  });

  it("calculates average of all valid numbers", () => {
    const result = getAverageRating([6.0, 8.0, 10.0]);
    expect(result.value).toBe(8.0);
    expect(result.displayValue).toBe("8.0");
    expect(result.ratedAttributeCount).toBe(3);
  });

  it("rounds to one decimal", () => {
    const result = getAverageRating([6.0, 8.0]);
    expect(result.value).toBe(7.0);
    expect(result.displayValue).toBe("7.0");
  });

  it("rejects values outside 1-10 range", () => {
    const result = getAverageRating([11, 6, -1, 8]);
    expect(result.ratedAttributeCount).toBe(2);
    expect(result.value).toBe(7.0);
  });
});