import { describe, it, expect } from "vitest";
import { getLeaguePeriodConfig, LEAGUE_PERIOD_CONFIG, REGULATION_ONLY_PERIOD_CONFIG } from "../period-config";
import { advancePeriod } from "../match-clock";

/**
 * Regression test for the 2026-08-24 bug: ending the second half of an ordinary league match
 * auto-started "ET — 1st half" because LEAGUE_PERIOD_CONFIG always included extra time
 * regardless of match type. Extra time should only be reachable for CUP matches.
 */
describe("getLeaguePeriodConfig", () => {
  it("returns the ET-inclusive config for CUP matches", () => {
    expect(getLeaguePeriodConfig("CUP")).toBe(LEAGUE_PERIOD_CONFIG);
    expect(getLeaguePeriodConfig("CUP").map((p) => p.key)).toContain("EXTRA_FIRST_HALF");
  });

  it.each(["LEAGUE", "FRIENDLY", "DEVELOPMENT"] as const)(
    "returns the regulation-only config for %s matches (no extra time)",
    (matchType) => {
      const config = getLeaguePeriodConfig(matchType);
      expect(config).toBe(REGULATION_ONLY_PERIOD_CONFIG);
      expect(config.map((p) => p.key)).not.toContain("EXTRA_FIRST_HALF");
      expect(config.map((p) => p.key)).toEqual(["BEFORE", "FIRST_HALF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"]);
    },
  );

  it("ending the second half of a regulation-only match goes straight to FULL_TIME, not extra time", () => {
    const config = getLeaguePeriodConfig("LEAGUE");
    const clock = { period: "SECOND_HALF" as const, running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock, config);
    expect(next.period).toBe("FULL_TIME");
    expect(next.running).toBe(false);
  });

  it("ending the second half of a CUP match still advances to extra time", () => {
    const config = getLeaguePeriodConfig("CUP");
    const clock = { period: "SECOND_HALF" as const, running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock, config);
    expect(next.period).toBe("EXTRA_FIRST_HALF");
    expect(next.running).toBe(true);
  });
});
