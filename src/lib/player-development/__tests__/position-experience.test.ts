import { describe, it, expect } from "vitest";
import { evaluatePositionEvidence } from "../position-experience";

describe("evaluatePositionEvidence", () => {
  const makeObs = (id: string, direction: "POSITIVE" | "NEGATIVE", daysAgo: number, matchId: string) => ({
    id,
    direction,
    observedAt: new Date(Date.now() - daysAgo * 86400000),
    matchId,
  });

  it("returns null for empty observations", () => {
    const result = evaluatePositionEvidence([], null);
    expect(result).toBeNull();
  });

  it("returns LOW confidence for fewer than 3 aligned observations", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
    ];
    const result = evaluatePositionEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("LOW");
    expect(result!.direction).toBeNull();
  });

  it("returns MEDIUM confidence for 3 aligned across 3 distinct matches", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
      makeObs("3", "POSITIVE", 15, "m3"),
    ];
    const result = evaluatePositionEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("MEDIUM");
    expect(result!.direction).toBe("POSITIVE");
  });

  it("returns HIGH confidence for 5+ aligned across 4+ distinct matches", () => {
    const observations = [
      makeObs("1", "POSITIVE", 1, "m1"),
      makeObs("2", "POSITIVE", 5, "m2"),
      makeObs("3", "POSITIVE", 10, "m3"),
      makeObs("4", "POSITIVE", 15, "m4"),
      makeObs("5", "POSITIVE", 20, "m5"),
    ];
    const result = evaluatePositionEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("HIGH");
    expect(result!.direction).toBe("POSITIVE");
  });

  it("returns LOW when aligned-contradictory gap is less than 2", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "NEGATIVE", 10, "m2"),
    ];
    const result = evaluatePositionEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("LOW");
  });

  it("filters by baseline date", () => {
    const baseline = new Date(Date.now() - 20 * 86400000);
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
      makeObs("3", "POSITIVE", 30, "m3"),
    ];
    const result = evaluatePositionEvidence(observations, baseline);
    expect(result).not.toBeNull();
    expect(result!.alignedCount).toBe(2);
  });

  it("one emergency appearance does not create suggestion (LOW confidence)", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
    ];
    const result = evaluatePositionEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("LOW");
    expect(result!.direction).toBeNull();
  });
});