import { describe, it, expect } from "vitest";
import { classifyRateTrajectory, classifyThemeTrajectory, classifyCombinationTrajectory } from "@/lib/team-season-profile/trajectory";
import { isMaterialRateDifference } from "@/lib/team-season-profile/rate-comparison";

describe("team-season-profile/rate-comparison", () => {
  it("requires at least 2 events in both windows", () => {
    expect(isMaterialRateDifference({ events: 1, exposureHours: 1 }, { events: 5, exposureHours: 1 })).toBe(false);
  });

  it("requires both relative and absolute thresholds", () => {
    // rates: 2/2=1.0 vs 2/2=1.0 -> no difference at all
    expect(isMaterialRateDifference({ events: 2, exposureHours: 2 }, { events: 2, exposureHours: 2 })).toBe(false);
    // rates: 3/1=3.0 vs 2/1=2.0 -> absolute diff 1.0 (>=0.5), relative 50% (>=0.5)
    expect(isMaterialRateDifference({ events: 3, exposureHours: 1 }, { events: 2, exposureHours: 1 })).toBe(true);
    // rates: 2.1/1=2.1 vs 2/1=2.0 -> absolute diff 0.1 (<0.5) -> not material
    expect(isMaterialRateDifference({ events: 21, exposureHours: 10 }, { events: 2, exposureHours: 1 })).toBe(false);
  });
});

describe("team-season-profile/trajectory — classifyRateTrajectory", () => {
  it("returns NEW when only the recent window has support", () => {
    const result = classifyRateTrajectory({ events: 0, exposureHours: 2, matches: 4 }, { events: 3, exposureHours: 1, matches: 4 });
    expect(result).toBe("NEW");
  });

  it("returns PERSISTENT when earlier and recent are both supported with no material difference", () => {
    const result = classifyRateTrajectory({ events: 4, exposureHours: 2, matches: 8 }, { events: 2, exposureHours: 1, matches: 4 });
    expect(result).toBe("PERSISTENT");
  });

  it("returns STRENGTHENING when recent rate is materially higher", () => {
    const result = classifyRateTrajectory({ events: 2, exposureHours: 2, matches: 8 }, { events: 3, exposureHours: 1, matches: 4 });
    expect(result).toBe("STRENGTHENING");
  });

  it("returns WEAKENING when recent rate is materially lower", () => {
    const result = classifyRateTrajectory({ events: 3, exposureHours: 1, matches: 8 }, { events: 2, exposureHours: 2, matches: 4 });
    expect(result).toBe("WEAKENING");
  });

  it("returns MIXED for contradictory small samples rather than forcing a trend", () => {
    const result = classifyRateTrajectory({ events: 1, exposureHours: 2, matches: 4 }, { events: 1, exposureHours: 1, matches: 4 });
    expect(result).toBe("MIXED");
  });

  it("returns DORMANT when an established earlier pattern has no recent recurrence despite recent exposure", () => {
    const result = classifyRateTrajectory({ events: 5, exposureHours: 3, matches: 8 }, { events: 0, exposureHours: 1, matches: 4 });
    expect(result).toBe("DORMANT");
  });

  it("does not return DORMANT when there is no relevant recent exposure at all", () => {
    const result = classifyRateTrajectory({ events: 5, exposureHours: 3, matches: 8 }, { events: 0, exposureHours: 0, matches: 0 });
    expect(result).not.toBe("DORMANT");
  });

  it("never needs to look past the recent window to decide — caller owns the season boundary", () => {
    // This function has no I/O and no date logic; it only consumes caller-bucketed windows.
    const earlier = { events: 3, exposureHours: 2, matches: 6 };
    const recent = { events: 3, exposureHours: 2, matches: 4 };
    expect(classifyRateTrajectory(earlier, recent)).toBe("PERSISTENT");
  });
});

describe("team-season-profile/trajectory — classifyThemeTrajectory", () => {
  it("returns NEW for a theme with no earlier-season support", () => {
    const result = classifyThemeTrajectory({ distinctMatchesWithTheme: 0, windowMatches: 6 }, { distinctMatchesWithTheme: 3, windowMatches: 4 });
    expect(result).toBe("NEW");
  });

  it("returns STRENGTHENING when recent prevalence is materially higher than season-wide prevalence", () => {
    // earlier: 2 of 10 matches (0.2/match) vs recent: 4 of 4 matches (1.0/match)
    const result = classifyThemeTrajectory({ distinctMatchesWithTheme: 2, windowMatches: 10 }, { distinctMatchesWithTheme: 4, windowMatches: 4 });
    expect(result).toBe("STRENGTHENING");
  });
});

describe("team-season-profile/trajectory — classifyCombinationTrajectory", () => {
  it("returns NEW when the combination only appears in the recent window", () => {
    expect(classifyCombinationTrajectory(false, true)).toBe("NEW");
  });

  it("returns DORMANT when an earlier combination has no recent recurrence", () => {
    expect(classifyCombinationTrajectory(true, false)).toBe("DORMANT");
  });

  it("returns PERSISTENT when present in both windows", () => {
    expect(classifyCombinationTrajectory(true, true)).toBe("PERSISTENT");
  });

  it("never returns STRENGTHENING or WEAKENING", () => {
    for (const earlier of [true, false]) {
      for (const recent of [true, false]) {
        const result = classifyCombinationTrajectory(earlier, recent);
        expect(["NEW", "PERSISTENT", "DORMANT"]).toContain(result);
      }
    }
  });
});
