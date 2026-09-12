import { describe, it, expect } from "vitest";
import { computeMatchOutcome } from "../match-outcome";

describe("computeMatchOutcome", () => {
  it("correctly determines a home win", () => {
    expect(computeMatchOutcome("HOME", 3, 1)).toBe("won");
  });

  it("correctly determines an away win", () => {
    expect(computeMatchOutcome("AWAY", 1, 3)).toBe("won");
  });

  it("correctly determines a home loss", () => {
    expect(computeMatchOutcome("HOME", 1, 3)).toBe("lost");
  });

  it("correctly determines an away loss", () => {
    expect(computeMatchOutcome("AWAY", 3, 1)).toBe("lost");
  });

  it("correctly determines a draw regardless of home/away", () => {
    expect(computeMatchOutcome("HOME", 2, 2)).toBe("drawn");
    expect(computeMatchOutcome("AWAY", 2, 2)).toBe("drawn");
  });

  it("returns null when either score is not yet known", () => {
    expect(computeMatchOutcome("HOME", null, 2)).toBeNull();
    expect(computeMatchOutcome("HOME", 2, null)).toBeNull();
    expect(computeMatchOutcome("HOME", null, null)).toBeNull();
  });
});
