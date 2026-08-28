import { describe, it, expect } from "vitest";
import { getLeaguePeriodConfig, getEventPeriodConfig, LEAGUE_PERIOD_CONFIG, REGULATION_ONLY_PERIOD_CONFIG } from "../period-config";
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

/**
 * Event matches previously hardcoded a single continuous "Match" period regardless of
 * Event.numberOfHalves (which didn't exist). numberOfHalves=2 must mirror League's
 * regulation-time period model, and matchDurationMinutes must mean "duration of one half" in
 * both cases -- for numberOfHalves=1 that is trivially the whole match, so existing 1-half
 * events see no behaviour change.
 */
describe("getEventPeriodConfig", () => {
  it("defaults to a single continuous 'Match' period when numberOfHalves is omitted", () => {
    const config = getEventPeriodConfig(20);
    expect(config.map((p) => p.key)).toEqual(["BEFORE", "FIRST_HALF", "FULL_TIME"]);
    expect(config.find((p) => p.key === "FIRST_HALF")).toMatchObject({ label: "Match", durationMs: 20 * 60 * 1000 });
  });

  it("numberOfHalves=1 is identical to the default (no behaviour change for existing events)", () => {
    expect(getEventPeriodConfig(20, 1)).toEqual(getEventPeriodConfig(20));
  });

  it("numberOfHalves=2 produces First half/Half time/Second half/Full time", () => {
    const config = getEventPeriodConfig(20, 2);
    expect(config.map((p) => p.key)).toEqual(["BEFORE", "FIRST_HALF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"]);
  });

  it("numberOfHalves=2 applies matchDurationMinutes to BOTH halves individually, not split across the match", () => {
    const config = getEventPeriodConfig(20, 2);
    const firstHalf = config.find((p) => p.key === "FIRST_HALF");
    const secondHalf = config.find((p) => p.key === "SECOND_HALF");
    expect(firstHalf?.durationMs).toBe(20 * 60 * 1000);
    expect(secondHalf?.durationMs).toBe(20 * 60 * 1000);
  });

  it("numberOfHalves=2 with no duration set leaves both halves undurated (manual clock)", () => {
    const config = getEventPeriodConfig(null, 2);
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBeNull();
    expect(config.find((p) => p.key === "SECOND_HALF")?.durationMs).toBeNull();
  });

  it("ending the first half of a 2-half event match advances to half time, then second half", () => {
    const config = getEventPeriodConfig(20, 2);
    const afterFirst = advancePeriod(
      { period: "FIRST_HALF", running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 },
      config,
    );
    expect(afterFirst.period).toBe("HALF_TIME");
    const afterHalfTime = advancePeriod(
      { period: "HALF_TIME", running: false, startedAt: new Date(), elapsedBeforeStartMs: 0 },
      config,
    );
    expect(afterHalfTime.period).toBe("SECOND_HALF");
  });

  it("ending the second half of a 2-half event match goes to full time", () => {
    const config = getEventPeriodConfig(20, 2);
    const next = advancePeriod(
      { period: "SECOND_HALF", running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 },
      config,
    );
    expect(next.period).toBe("FULL_TIME");
  });
});
