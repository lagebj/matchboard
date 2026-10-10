import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  eligibleMatches,
  eligibleMatchesWithOneIncomplete,
  eligibleMatchesWithDuplicateMatchId,
  identity,
  rawRecordsForHash,
} from "../fixtures";
import { computeWindowComparison } from "../view-model";

describe("A04-S3 role-exposure-supported fixture", () => {
  it("has exactly six distinct eligible matches, all COMPLETE", () => {
    expect(new Set(eligibleMatches.map((m) => m.matchId)).size).toBe(6);
    expect(eligibleMatches.every((m) => m.coverage === "COMPLETE")).toBe(true);
  });

  it("derives the prior-3/latest-3 totals from the actual intervals, matching the documented 37/67 example", () => {
    const comparison = computeWindowComparison();
    expect(comparison.priorMatches.map((m) => m.minutes)).toEqual([10, 12, 15]);
    expect(comparison.latestMatches.map((m) => m.minutes)).toEqual([20, 22, 25]);
    expect(comparison.priorTotal).toBe(37);
    expect(comparison.latestTotal).toBe(67);
    expect(comparison.priorDenominator).toBe(3);
    expect(comparison.latestDenominator).toBe(3);
  });

  it("computes direction from the real totals rather than asserting it by fiat", () => {
    const comparison = computeWindowComparison();
    expect(comparison.direction).toBe(comparison.latestTotal > comparison.priorTotal ? "higher" : "lower");
    expect(comparison.direction).toBe("higher");
  });

  describe("independent review round 1 (PR #778, verification gap): typed coverage is checked, not inferred", () => {
    it("rejects the sample when one observation is actually NOT_RECORDED, instead of silently treating it as measured", () => {
      expect(() => computeWindowComparison(eligibleMatchesWithOneIncomplete)).toThrow(/requires every observation to be COMPLETE/);
    });

    it("rejects a duplicated matchId instead of silently double-counting it", () => {
      expect(() => computeWindowComparison(eligibleMatchesWithDuplicateMatchId)).toThrow(/Duplicate match id/);
    });
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
