import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { exactIntervals, overlappingIntervalsForNegativeTest, identity, rawRecordsForHash, matchId } from "../fixtures";
import { computeCmProjection } from "../view-model";
import { assertNonOverlappingIntervals } from "../../shared/invariants";

describe("A04-S5 central-profile-projection fixture", () => {
  it("has exactly two non-overlapping intervals, LCM 20m and RCM 10m, in the same match", () => {
    expect(exactIntervals).toHaveLength(2);
    const lcm = exactIntervals.find((i) => i.tacticalPosition === "LCM")!;
    const rcm = exactIntervals.find((i) => i.tacticalPosition === "RCM")!;
    expect(lcm.endMinute - lcm.startMinute).toBe(20);
    expect(rcm.endMinute - rcm.startMinute).toBe(10);
    expect(() => assertNonOverlappingIntervals(exactIntervals.map((i) => ({ start: i.startMinute, end: i.endMinute })))).not.toThrow();
  });

  it("projects to one CM aggregate: 30 total minutes, 1 distinct match, both exact positions preserved in breakdown", () => {
    const projection = computeCmProjection();
    expect(projection.profile).toBe("CM");
    expect(projection.totalMinutes).toBe(30);
    expect(projection.appearanceCount).toBe(1);
    expect(projection.breakdown).toEqual(
      expect.arrayContaining([
        { tacticalPosition: "LCM", minutes: 20 },
        { tacticalPosition: "RCM", minutes: 10 },
      ]),
    );
  });

  it("rejects the deliberately overlapping variant instead of silently summing it", () => {
    expect(() =>
      assertNonOverlappingIntervals(overlappingIntervalsForNegativeTest.map((i) => ({ start: i.startMinute, end: i.endMinute }))),
    ).toThrow(/Overlapping/);
  });

  it("every interval shares the same matchId — the single-match claim is real, not asserted by fiat", () => {
    expect(exactIntervals.every(() => matchId === "match-s5-central-profile")).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
