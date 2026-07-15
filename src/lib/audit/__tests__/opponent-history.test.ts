import { describe, it, expect } from "vitest";

describe("Opponent history result calculation", () => {
  it("correctly determines home win", () => {
    const isHome = true;
    const homeGoals = 3;
    const awayGoals = 1;
    const result = homeGoals > awayGoals ? (isHome ? "won" : "lost") : homeGoals < awayGoals ? (isHome ? "lost" : "won") : "drawn";
    expect(result).toBe("won");
  });

  it("correctly determines away win", () => {
    const isHome = false;
    const homeGoals = 1;
    const awayGoals = 3;
    const result = homeGoals > awayGoals ? (isHome ? "won" : "lost") : homeGoals < awayGoals ? (isHome ? "lost" : "won") : "drawn";
    expect(result).toBe("won");
  });

  it("correctly determines home loss", () => {
    const isHome = true;
    const homeGoals = 1;
    const awayGoals = 3;
    const result = homeGoals > awayGoals ? (isHome ? "won" : "lost") : homeGoals < awayGoals ? (isHome ? "lost" : "won") : "drawn";
    expect(result).toBe("lost");
  });

  it("correctly determines draw", () => {
    const isHome = true;
    const homeGoals = 2;
    const awayGoals = 2;
    const result = homeGoals > awayGoals ? (isHome ? "won" : "lost") : homeGoals < awayGoals ? (isHome ? "lost" : "won") : "drawn";
    expect(result).toBe("drawn");
  });
});