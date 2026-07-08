import { describe, it, expect } from "vitest";
import { getPlayerOverallRating, getAverageRating } from "../player-rating";

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

  it("calculates average of all valid attributes", () => {
    const result = getPlayerOverallRating({
      ballControl: 3,
      passing: 4,
      firstTouch: 3,
      oneVOneAttacking: 2,
      positioning: 4,
      oneVOneDefending: 3,
      decisionMaking: 5,
      effort: 3,
      teamplay: 4,
      concentration: 2,
      speed: 3,
      strength: 4,
    });

    expect(result.value).toBe(3.3);
    expect(result.displayValue).toBe("3.3");
    expect(result.ratedAttributeCount).toBe(12);
  });

  it("excludes null attributes from the average", () => {
    const result = getPlayerOverallRating({
      ballControl: 3,
      passing: null,
      firstTouch: 3,
      oneVOneAttacking: null,
      positioning: 3,
      oneVOneDefending: null,
      decisionMaking: 3,
      effort: null,
      teamplay: null,
      concentration: null,
      speed: null,
      strength: null,
    });

    expect(result.value).toBe(3.0);
    expect(result.ratedAttributeCount).toBe(4);
  });

  it("treats 0 as unrated, not as a low score", () => {
    const result = getPlayerOverallRating({
      ballControl: 0,
      passing: 3,
    });

    expect(result.ratedAttributeCount).toBe(1);
    expect(result.value).toBe(3.0);
  });

  it("rounds display value to one decimal", () => {
    const result = getPlayerOverallRating({
      ballControl: 3,
      passing: 4,
      firstTouch: 3,
    });

    const sum = 3 + 4 + 3;
    const expected = Math.round((sum / 3) * 10) / 10;
    expect(result.value).toBe(expected);
    expect(result.displayValue).toBe(expected.toFixed(1));
  });

  it("works with a single rated attribute", () => {
    const result = getPlayerOverallRating({ effort: 4 });

    expect(result.value).toBe(4.0);
    expect(result.displayValue).toBe("4.0");
    expect(result.ratedAttributeCount).toBe(1);
  });

  it("ignores values outside 1-5 range", () => {
    const result = getPlayerOverallRating({
      ballControl: 6,
      passing: 3,
      effort: -1,
    });

    expect(result.ratedAttributeCount).toBe(1);
    expect(result.value).toBe(3.0);
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
    const result = getAverageRating([3.2, null, 4.1, null, 2.8]);
    expect(result.value).toBeCloseTo(3.4, 1);
    expect(result.ratedAttributeCount).toBe(3);
  });

  it("calculates average of all valid numbers", () => {
    const result = getAverageRating([3.0, 4.0, 5.0]);
    expect(result.value).toBe(4.0);
    expect(result.displayValue).toBe("4.0");
    expect(result.ratedAttributeCount).toBe(3);
  });

  it("rounds to one decimal", () => {
    const result = getAverageRating([3.0, 4.0]);
    expect(result.value).toBe(3.5);
    expect(result.displayValue).toBe("3.5");
  });
});