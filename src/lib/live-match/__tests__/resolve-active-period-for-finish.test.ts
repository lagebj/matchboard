import { describe, it, expect } from "vitest";
import { resolveActivePeriodForFinish } from "../resolve-active-period-for-finish";

const MIN = 60 * 1000;

describe("resolveActivePeriodForFinish (ADR-0146 §6/§9, bundle §03 worked examples)", () => {
  describe("with a frozen format snapshot", () => {
    // Bundle §03.1 table: intended -> allowance -> ceiling.
    it.each([
      [20, 10, 30],
      [25, 10, 35],
      [30, 10, 40],
      [35, 10, 45],
      [40, 10, 50],
    ])("intended %imin -> allowance %imin -> ceiling %imin", (intendedMin, _allowanceMin, ceilingMin) => {
      const belowCeiling = resolveActivePeriodForFinish({
        period: "FIRST_HALF",
        rawElapsedMs: ceilingMin * MIN - MIN,
        intendedPeriodDurationMs: intendedMin * MIN,
      });
      expect(belowCeiling.resolutionSource).toBe("FINISH_LIVE_REPORTING");
      expect(belowCeiling.reviewStatus).toBe("NOT_REQUIRED");
      expect(belowCeiling.resolvedDurationMs).toBe(ceilingMin * MIN - MIN);

      const aboveCeiling = resolveActivePeriodForFinish({
        period: "FIRST_HALF",
        rawElapsedMs: ceilingMin * MIN + MIN,
        intendedPeriodDurationMs: intendedMin * MIN,
      });
      expect(aboveCeiling.resolutionSource).toBe("RECOVERED_BOUNDED");
      expect(aboveCeiling.reviewStatus).toBe("NEEDS_REVIEW");
      expect(aboveCeiling.resolvedDurationMs).toBe(ceilingMin * MIN);
      expect(aboveCeiling.rawElapsedMs).toBe(ceilingMin * MIN + MIN);
    });

    // 45min -> 25% is 11m15s, exceeding the 10-minute floor -> 56m15s ceiling (bundle's own example).
    it("uses the 25% allowance, not the 10-minute floor, once 25% exceeds it (45m -> 56m15s)", () => {
      const ceilingMs = 56 * MIN + 15_000;
      expect(
        resolveActivePeriodForFinish({ period: "FIRST_HALF", rawElapsedMs: ceilingMs, intendedPeriodDurationMs: 45 * MIN })
          .resolutionSource,
      ).toBe("FINISH_LIVE_REPORTING");
      expect(
        resolveActivePeriodForFinish({ period: "FIRST_HALF", rawElapsedMs: ceilingMs + 1, intendedPeriodDurationMs: 45 * MIN })
          .resolutionSource,
      ).toBe("RECOVERED_BOUNDED");
    });

    // TEST-PLAN §13/§14's exact worked example: 30m format, 36m raw (within 40m ceiling) vs 4h raw (far above).
    it("TEST-PLAN §13: 30m format, 36m raw -> resolves to 36m, not clamped, not flagged", () => {
      const resolution = resolveActivePeriodForFinish({ period: "SECOND_HALF", rawElapsedMs: 36 * MIN, intendedPeriodDurationMs: 30 * MIN });
      expect(resolution).toEqual({
        period: "SECOND_HALF",
        rawElapsedMs: 36 * MIN,
        resolvedDurationMs: 36 * MIN,
        resolutionSource: "FINISH_LIVE_REPORTING",
        reviewStatus: "NOT_REQUIRED",
      });
    });

    it("TEST-PLAN §14: 30m format, 4h raw -> resolves to the 40m ceiling, flags review, preserves raw", () => {
      const fourHoursMs = 4 * 60 * MIN;
      const resolution = resolveActivePeriodForFinish({ period: "SECOND_HALF", rawElapsedMs: fourHoursMs, intendedPeriodDurationMs: 30 * MIN });
      expect(resolution).toEqual({
        period: "SECOND_HALF",
        rawElapsedMs: fourHoursMs,
        resolvedDurationMs: 40 * MIN,
        resolutionSource: "RECOVERED_BOUNDED",
        reviewStatus: "NEEDS_REVIEW",
      });
    });
  });

  // TEST-PLAN §16 — legacy (no frozen format): 60-minute ceiling, never a guessed football duration.
  describe("with no frozen format (legacy 60-minute ceiling)", () => {
    it.each([
      [45, "FINISH_LIVE_REPORTING", "NOT_REQUIRED", 45],
      [60, "FINISH_LIVE_REPORTING", "NOT_REQUIRED", 60],
      [90, "RECOVERED_BOUNDED", "NEEDS_REVIEW", 60],
      [4 * 60, "RECOVERED_BOUNDED", "NEEDS_REVIEW", 60],
    ] as const)("raw %imin -> %s / %s, resolved %imin", (rawMin, source, reviewStatus, resolvedMin) => {
      const resolution = resolveActivePeriodForFinish({
        period: "FIRST_HALF",
        rawElapsedMs: rawMin * MIN,
        intendedPeriodDurationMs: null,
      });
      expect(resolution.resolutionSource).toBe(source);
      expect(resolution.reviewStatus).toBe(reviewStatus);
      expect(resolution.resolvedDurationMs).toBe(resolvedMin * MIN);
      if (source === "RECOVERED_BOUNDED") {
        expect(resolution.rawElapsedMs).toBe(rawMin * MIN);
      }
    });
  });
});
