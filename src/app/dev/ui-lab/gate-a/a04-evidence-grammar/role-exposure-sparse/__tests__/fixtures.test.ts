import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { eligibleMatches, identity, rawRecordsForHash } from "../fixtures";
import { computeExposureCoverage, observedExposures } from "../view-model";

describe("A04-S2 role-exposure-sparse fixture", () => {
  it("has exactly 6 eligible matches and exactly 2 with usable recorded exposure", () => {
    expect(eligibleMatches).toHaveLength(6);
    const { observed, denominator } = computeExposureCoverage();
    expect(denominator).toBe(6);
    expect(observed).toBe(2);
  });

  it("the four missing matches are NOT_RECORDED, never a hidden minutes:0", () => {
    const missing = eligibleMatches.filter((m) => m.coverage === "NOT_RECORDED");
    expect(missing).toHaveLength(4);
    for (const m of missing) expect(m.minutes).toBeUndefined();
  });

  it("exposes exactly the two real recorded observations as discrete records", () => {
    const observed = observedExposures();
    expect(observed).toEqual([
      { matchLabel: "Match 2", minutes: 18 },
      { matchLabel: "Match 5", minutes: 24 },
    ]);
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
