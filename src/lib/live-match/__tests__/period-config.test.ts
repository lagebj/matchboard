import { describe, it, expect } from "vitest";
import {
  getLeaguePeriodConfig,
  getLeagueMatchPeriodConfig,
  getEventPeriodConfig,
  buildPeriodConfigFromFormat,
  getCumulativePeriodOffsetsMs,
  toAbsoluteMatchMs,
  computeAbsoluteMatchSecondsForPlan,
  getTotalPeriodDurationMs,
  resolvePeriodForAbsoluteMs,
  LEAGUE_PERIOD_CONFIG,
  REGULATION_ONLY_PERIOD_CONFIG,
} from "../period-config";
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

/**
 * ADR-0146: the shared match-format domain builder both League and Event use once a format is
 * configured/resolved. getEventPeriodConfig() (above) becomes a thin wrapper over this for the
 * "duration is set" case -- these tests pin down the builder directly.
 */
describe("buildPeriodConfigFromFormat", () => {
  it("numberOfPeriods=1 produces a single continuous 'Match' period, matching getEventPeriodConfig's existing 1-half shape", () => {
    const config = buildPeriodConfigFromFormat({ numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 0 });
    expect(config).toEqual(getEventPeriodConfig(40, 1));
  });

  it("numberOfPeriods=2 produces First half/Half time/Second half/Full time, matching getEventPeriodConfig's existing 2-half shape", () => {
    const config = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 10 });
    expect(config).toEqual(getEventPeriodConfig(30, 2, 10));
  });

  it("applies periodDurationMinutes to each period individually (not split across the match)", () => {
    const config = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 5 });
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(25 * 60 * 1000);
    expect(config.find((p) => p.key === "SECOND_HALF")?.durationMs).toBe(25 * 60 * 1000);
    expect(config.find((p) => p.key === "HALF_TIME")?.durationMs).toBe(5 * 60 * 1000);
  });

  it("a zero break duration is a tracked zero, not 'untracked'", () => {
    const config = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 0 });
    expect(config.find((p) => p.key === "HALF_TIME")?.durationMs).toBe(0);
  });

  it("ending the second half of a numberOfPeriods=2 format goes to full time, exactly like advancing League's/Event's existing 2-half configs", () => {
    const config = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 10 });
    const next = advancePeriod(
      { period: "SECOND_HALF", running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 },
      config,
    );
    expect(next.period).toBe("FULL_TIME");
  });
});

/**
 * ADR-0146: League's period config once a match format is configured/resolved. Legacy/
 * unconfigured behavior must stay byte-identical (getLeagueMatchPeriodConfig(matchType, null) ===
 * getLeaguePeriodConfig(matchType)); a configured format must preserve CUP extra time exactly.
 */
describe("getLeagueMatchPeriodConfig", () => {
  it("falls back to getLeaguePeriodConfig unchanged when no format is resolved (null)", () => {
    expect(getLeagueMatchPeriodConfig("LEAGUE", null)).toBe(getLeaguePeriodConfig("LEAGUE"));
    expect(getLeagueMatchPeriodConfig("CUP", null)).toBe(getLeaguePeriodConfig("CUP"));
  });

  it("uses the configured format for a non-CUP match, with no extra time", () => {
    const config = getLeagueMatchPeriodConfig("LEAGUE", { numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });
    expect(config.map((p) => p.key)).toEqual(["BEFORE", "FIRST_HALF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"]);
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(30 * 60 * 1000);
    expect(config.find((p) => p.key === "HALF_TIME")?.durationMs).toBe(15 * 60 * 1000);
  });

  it("inserts the existing fixed-duration extra time before FULL_TIME for a configured CUP match", () => {
    const config = getLeagueMatchPeriodConfig("CUP", { numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });
    expect(config.map((p) => p.key)).toEqual([
      "BEFORE",
      "FIRST_HALF",
      "HALF_TIME",
      "SECOND_HALF",
      "EXTRA_FIRST_HALF",
      "EXTRA_HALF_TIME",
      "EXTRA_SECOND_HALF",
      "FULL_TIME",
    ]);
    // Extra time stays the existing fixed 10-minute halves -- not derived from the configured format.
    expect(config.find((p) => p.key === "EXTRA_FIRST_HALF")?.durationMs).toBe(10 * 60 * 1000);
    // Regular periods still use the configured format, not the legacy 25-minute default.
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(30 * 60 * 1000);
  });

  it("a configured single-period (numberOfPeriods=1) CUP match still appends extra time before full time", () => {
    const config = getLeagueMatchPeriodConfig("CUP", { numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 0 });
    expect(config.map((p) => p.key)).toEqual(["BEFORE", "FIRST_HALF", "EXTRA_FIRST_HALF", "EXTRA_HALF_TIME", "EXTRA_SECOND_HALF", "FULL_TIME"]);
  });

  it("ending the second half of a configured CUP match advances to extra time, not full time", () => {
    const config = getLeagueMatchPeriodConfig("CUP", { numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });
    const next = advancePeriod(
      { period: "SECOND_HALF", running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 },
      config,
    );
    expect(next.period).toBe("EXTRA_FIRST_HALF");
  });
});

/**
 * Canonical match-state foundation (Bundle 1, ADR-0113): `MatchRotation`/`LiveMatchEvent`
 * timestamps are recorded relative to their OWN period (each period's live clock restarts at 0
 * -- match-clock.ts's advancePeriod), so a raw SECOND_HALF timestamp must never be compared
 * directly against a FIRST_HALF one without first adding this cumulative offset. Before this,
 * actual-timeline.ts's rotation/position-change ordering ignored period entirely, silently
 * mis-ordering any two-half match with recorded events in both halves.
 */
describe("getCumulativePeriodOffsetsMs / toAbsoluteMatchMs", () => {
  it("gives every period offset 0 when only one playing period exists (single-period event, unaffected)", () => {
    const config = getEventPeriodConfig(20);
    const offsets = getCumulativePeriodOffsetsMs(config);
    expect(offsets.FIRST_HALF).toBe(0);
  });

  it("offsets SECOND_HALF by FIRST_HALF's duration for a 2-half event with no tracked break", () => {
    const config = getEventPeriodConfig(20, 2);
    const offsets = getCumulativePeriodOffsetsMs(config);
    expect(offsets.FIRST_HALF).toBe(0);
    expect(offsets.SECOND_HALF).toBe(20 * 60 * 1000);
  });

  it("offsets SECOND_HALF by FIRST_HALF's duration plus the tracked half-time break", () => {
    const config = getEventPeriodConfig(20, 2, 5);
    const offsets = getCumulativePeriodOffsetsMs(config);
    expect(offsets.SECOND_HALF).toBe((20 + 5) * 60 * 1000);
  });

  it("converts a period-relative timestamp to one continuous absolute match-clock value", () => {
    const config = getLeaguePeriodConfig("LEAGUE"); // 25-minute halves, no tracked break
    const offsets = getCumulativePeriodOffsetsMs(config);

    // A rotation 3 minutes into the second half (period-relative, resets to 0 at kickoff of
    // that half) must sort AFTER every first-half rotation, not before.
    const secondHalfSub = toAbsoluteMatchMs("SECOND_HALF", 3 * 60 * 1000, offsets);
    const firstHalfSub = toAbsoluteMatchMs("FIRST_HALF", 20 * 60 * 1000, offsets);
    expect(secondHalfSub).toBeGreaterThan(firstHalfSub);
    expect(secondHalfSub).toBe(25 * 60 * 1000 + 3 * 60 * 1000);
  });

  it("falls back to offset 0 for a null/undefined period (single-period match, backward compatible)", () => {
    expect(toAbsoluteMatchMs(null, 12345, {})).toBe(12345);
    expect(toAbsoluteMatchMs(undefined, 12345, {})).toBe(12345);
  });

  it("falls back to offset 0 for a period absent from the config (e.g. stray extra-time value on a regulation-only match)", () => {
    const offsets = getCumulativePeriodOffsetsMs(REGULATION_ONLY_PERIOD_CONFIG);
    expect(toAbsoluteMatchMs("EXTRA_FIRST_HALF", 1000, offsets)).toBe(1000);
  });
});

describe("getTotalPeriodDurationMs", () => {
  it("sums both halves for a 2-half event (previously only the first half's duration was used to cap the timeline)", () => {
    const config = getEventPeriodConfig(20, 2);
    expect(getTotalPeriodDurationMs(config)).toBe(40 * 60 * 1000);
  });

  it("includes the tracked half-time break in the total", () => {
    const config = getEventPeriodConfig(20, 2, 5);
    expect(getTotalPeriodDurationMs(config)).toBe((20 + 5 + 20) * 60 * 1000);
  });

  it("returns null when no duration is configured", () => {
    expect(getTotalPeriodDurationMs(getEventPeriodConfig(null))).toBeNull();
  });
});

describe("resolvePeriodForAbsoluteMs", () => {
  it("resolves an absolute ms value within the first half to FIRST_HALF", () => {
    const config = getEventPeriodConfig(20, 2);
    expect(resolvePeriodForAbsoluteMs(5 * 60 * 1000, config)).toBe("FIRST_HALF");
  });

  it("resolves an absolute ms value within the second half to SECOND_HALF", () => {
    const config = getEventPeriodConfig(20, 2);
    expect(resolvePeriodForAbsoluteMs(20 * 60 * 1000 + 5 * 60 * 1000, config)).toBe("SECOND_HALF");
  });

  it("falls back to the last playing period at/after the final known duration (e.g. exactly full time)", () => {
    const config = getEventPeriodConfig(20, 2);
    expect(resolvePeriodForAbsoluteMs(40 * 60 * 1000, config)).toBe("SECOND_HALF");
  });

  it("returns null when the config has no playing period at all", () => {
    expect(resolvePeriodForAbsoluteMs(1000, [])).toBeNull();
  });
});

describe("computeAbsoluteMatchSecondsForPlan", () => {
  // ARR-0053's worked example: a 2x30 match, a plan change for "minute 40" (approximateMatchSeconds
  // = 2400), applied on time 10 real minutes into the second half. Before this fix,
  // applyPlannedChangeAction persisted the raw period-relative offset (600s) as
  // actualMatchSeconds directly, so rotation-vs-actual.ts's `actualMatchSeconds -
  // approximateMatchSeconds` read as `600 - 2400 = -1800` -- "applied 30 min earlier than
  // planned" -- when it was applied exactly on time.
  const twoByThirty = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 30, breakDurationMinutes: 15 });

  it("converts a second-half period-relative offset to the same absolute unit as approximateMatchSeconds", () => {
    const tenMinutesIntoSecondHalf = 10 * 60 * 1000;
    const actualMatchSeconds = computeAbsoluteMatchSecondsForPlan(tenMinutesIntoSecondHalf, "SECOND_HALF", twoByThirty);

    // Absolute: 30 minutes (first half) + 10 minutes (into second half) = minute 40 -- matches
    // the "minute 40" plan exactly, not -1800.
    expect(actualMatchSeconds).toBe(40 * 60);

    const approximateMatchSeconds = 40 * 60;
    expect(actualMatchSeconds - approximateMatchSeconds).toBe(0);
  });

  it("leaves a first-half offset unchanged (period offset is 0, matches pre-fix behavior exactly)", () => {
    const fiveMinutesIntoFirstHalf = 5 * 60 * 1000;
    expect(computeAbsoluteMatchSecondsForPlan(fiveMinutesIntoFirstHalf, "FIRST_HALF", twoByThirty)).toBe(5 * 60);
  });

  it("never returns negative seconds", () => {
    expect(computeAbsoluteMatchSecondsForPlan(-1000, "FIRST_HALF", twoByThirty)).toBe(0);
  });

  it("treats a null/undefined period as offset 0, same as toAbsoluteMatchMs", () => {
    expect(computeAbsoluteMatchSecondsForPlan(5 * 60 * 1000, null, twoByThirty)).toBe(5 * 60);
  });
});
