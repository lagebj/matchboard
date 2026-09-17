import { describe, it, expect } from "vitest";
import {
  LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES,
  LIVE_REPORTING_STRONG_WARNING_MINUTES,
  LIVE_REPORTING_AUTO_FINISH_MINUTES,
  LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES,
  PERIOD_OVERRUN_ALLOWANCE_MIN_MINUTES,
  PERIOD_OVERRUN_ALLOWANCE_RATIO,
  periodOverrunAllowanceMs,
  activePeriodRecoveryCeilingMs,
  expectedWallClockDurationMs,
  matchOverrunAllowanceMs,
  contextualMatchWarningAtMs,
  contextualWarningAtMs,
  periodOverrunWarningAtMs,
  resolveLiveReportingWarning,
  type LiveReportingWarning,
} from "@/lib/live-match/live-reporting-guardrails";
import type { MatchFormatDefinition } from "@/lib/live-match/match-format";

const TWO_BY_25: MatchFormatDefinition = {
  numberOfPeriods: 2,
  periodDurationMinutes: 25,
  breakDurationMinutes: 10,
};

function minutes(n: number): number {
  return n * 60 * 1000;
}

describe("ADR-0146 §3: guardrail constants", () => {
  it("uses the bundle's absolute Live Reporting limits", () => {
    expect(LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES).toBe(180);
    expect(LIVE_REPORTING_STRONG_WARNING_MINUTES).toBe(240);
    expect(LIVE_REPORTING_AUTO_FINISH_MINUTES).toBe(270);
    expect(LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES).toBe(60);
  });
});

describe("periodOverrunAllowanceMs", () => {
  it("is 10 minutes (the floor) for a 20-minute period — 25% would be 5", () => {
    expect(periodOverrunAllowanceMs(minutes(20))).toBe(minutes(10));
  });

  it("is 25% once that exceeds 10 minutes — 45-minute period gets 11m15s", () => {
    expect(periodOverrunAllowanceMs(minutes(45))).toBe(minutes(45) * 0.25);
  });

  it("is exactly 10 minutes at the crossover — 40-minute period: 25% = 10", () => {
    expect(periodOverrunAllowanceMs(minutes(40))).toBe(minutes(10));
  });

  it("exposes the floor/ratio constants matching the formula max(10m, 25%)", () => {
    expect(PERIOD_OVERRUN_ALLOWANCE_MIN_MINUTES).toBe(10);
    expect(PERIOD_OVERRUN_ALLOWANCE_RATIO).toBe(0.25);
  });
});

describe("activePeriodRecoveryCeilingMs", () => {
  it("is intended period duration + allowance — 25-minute period → 35 minutes", () => {
    expect(activePeriodRecoveryCeilingMs(minutes(25))).toBe(minutes(35));
  });

  it("matches the bundle's example table (20→30, 30→40, 40→50, 45→56m15s)", () => {
    expect(activePeriodRecoveryCeilingMs(minutes(20))).toBe(minutes(30));
    expect(activePeriodRecoveryCeilingMs(minutes(30))).toBe(minutes(40));
    expect(activePeriodRecoveryCeilingMs(minutes(40))).toBe(minutes(50));
    expect(activePeriodRecoveryCeilingMs(minutes(45))).toBe(minutes(45) + minutes(45) * 0.25);
  });
});

describe("contextualMatchWarningAtMs", () => {
  it("is expected wall-clock + max(30m, 50% of expected) — 2×25+10 break = 60 → 90", () => {
    expect(expectedWallClockDurationMs(TWO_BY_25)).toBe(minutes(60));
    expect(matchOverrunAllowanceMs(minutes(60))).toBe(minutes(30));
    expect(contextualMatchWarningAtMs(TWO_BY_25)).toBe(minutes(90));
  });

  it("uses the 50% term once that exceeds 30 minutes — 2×60 periods = 120+59→179 expected → 50%", () => {
    const format: MatchFormatDefinition = { numberOfPeriods: 2, periodDurationMinutes: 60, breakDurationMinutes: 59 };
    const expected = minutes(179);
    expect(expectedWallClockDurationMs(format)).toBe(expected);
    expect(matchOverrunAllowanceMs(expected)).toBe(expected * 0.5);
    expect(contextualMatchWarningAtMs(format)).toBe(expected * 1.5);
  });

  it("ignores the break for a single-period format — expected is just the period", () => {
    const format: MatchFormatDefinition = { numberOfPeriods: 1, periodDurationMinutes: 40, breakDurationMinutes: 15 };
    expect(expectedWallClockDurationMs(format)).toBe(minutes(40));
    expect(contextualMatchWarningAtMs(format)).toBe(minutes(40) + minutes(30));
  });
});

describe("periodOverrunWarningAtMs", () => {
  it("is the playing period's duration + its overrun allowance", () => {
    expect(periodOverrunWarningAtMs(minutes(25))).toBe(minutes(35));
  });

  it("equals the active-period recovery ceiling — the same threshold the finish-time recovery uses", () => {
    expect(periodOverrunWarningAtMs(minutes(45))).toBe(activePeriodRecoveryCeilingMs(minutes(45)));
  });
});

describe("resolveLiveReportingWarning", () => {
  const startedAt = new Date("2026-09-17T10:00:00Z");

  function warningAt(format: MatchFormatDefinition | null, elapsedMinutes: number, periodElapsedMinutes?: number): LiveReportingWarning | null {
    return resolveLiveReportingWarning({
      format,
      liveReportingStartedAt: startedAt,
      nowMs: startedAt.getTime() + minutes(elapsedMinutes),
      activePeriodElapsedMs: periodElapsedMinutes != null ? minutes(periodElapsedMinutes) : null,
      activePeriodDurationMs: periodElapsedMinutes != null ? minutes(25) : null,
    });
  }

  it("returns null well inside every threshold", () => {
    expect(warningAt(TWO_BY_25, 30, 10)).toBeNull();
  });

  it("returns PERIOD_OVERRUN when the active period passes its configured allowance", () => {
    expect(warningAt(TWO_BY_25, 40, 36)?.kind).toBe("PERIOD_OVERRUN");
  });

  it("returns CONTEXTUAL_MATCH when live reporting passes expected+allowance (90m for 2×25+10)", () => {
    expect(warningAt(TWO_BY_25, 91)?.kind).toBe("CONTEXTUAL_MATCH");
  });

  it("returns LEGACY_FALLBACK at 180 minutes when no format snapshot exists", () => {
    expect(warningAt(null, 179)).toBeNull();
    expect(warningAt(null, 181)?.kind).toBe("LEGACY_FALLBACK");
  });

  it("never returns LEGACY_FALLBACK when a format snapshot exists, even past the contextual threshold", () => {
    expect(warningAt(TWO_BY_25, 200)?.kind).toBe("CONTEXTUAL_MATCH");
  });

  it("returns STRONG at 240 minutes regardless of format or scheduled kickoff", () => {
    expect(warningAt(TWO_BY_25, 245)?.kind).toBe("STRONG");
    expect(warningAt(null, 245)?.kind).toBe("STRONG");
  });

  it("returns EXPIRED at 270 minutes — the server auto-finish threshold has passed", () => {
    expect(warningAt(TWO_BY_25, 275)?.kind).toBe("EXPIRED");
    expect(warningAt(null, 275)?.kind).toBe("EXPIRED");
  });

  it("supersedes every lower warning — one warning kind at a time, highest severity wins", () => {
    // Period overrun + contextual + strong all true at 245m with a 40m-old period: STRONG wins.
    const w = warningAt(TWO_BY_25, 245, 40)!;
    expect(w.kind).toBe("STRONG");
  });

  it("still surfaces PERIOD_OVERRUN alongside CONTEXTUAL_MATCH after the contextual threshold when the period is the newest signal", () => {
    // At 92 minutes (contextual) with no active-period overrun, the contextual warning is the signal.
    expect(warningAt(TWO_BY_25, 92, 20)?.kind).toBe("CONTEXTUAL_MATCH");
  });
});

describe("contextualWarningAtMs", () => {
  it("anchors only to liveReportingStartedAt — kickoff is never an input", () => {
    const startedAt = new Date("2026-09-17T10:00:00Z");
    expect(contextualWarningAtMs(TWO_BY_25, startedAt)).toBe(startedAt.getTime() + minutes(90));
    // A match scheduled four hours earlier or later cannot move this threshold: only the
    // session's own start date is an input, so the offset from start is invariant.
    const shifted = new Date(startedAt.getTime() + minutes(240));
    expect(contextualWarningAtMs(TWO_BY_25, shifted) - shifted.getTime())
      .toBe(contextualWarningAtMs(TWO_BY_25, startedAt) - startedAt.getTime());
  });

  it("falls back to the fixed 180-minute threshold without a format snapshot", () => {
    expect(contextualWarningAtMs(null, new Date(0))).toBe(minutes(180));
  });
});