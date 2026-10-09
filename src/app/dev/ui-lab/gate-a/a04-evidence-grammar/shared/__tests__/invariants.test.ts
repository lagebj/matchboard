import { describe, it, expect } from "vitest";
import { assertNonOverlappingIntervals, isActiveEvidence, describeConflict } from "../invariants";

/**
 * A04 additional mandatory data-truth tests #2–#5 (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`).
 */
describe("assertNonOverlappingIntervals", () => {
  it("accepts non-overlapping intervals (the S5 LCM 0-20 / RCM 20-30 shape)", () => {
    expect(() => assertNonOverlappingIntervals([{ start: 0, end: 20 }, { start: 20, end: 30 }])).not.toThrow();
  });

  it("rejects overlapping intervals instead of silently summing them", () => {
    expect(() => assertNonOverlappingIntervals([{ start: 0, end: 25 }, { start: 20, end: 30 }])).toThrow(/Overlapping/);
  });

  it("rejects duplicated identical intervals", () => {
    expect(() => assertNonOverlappingIntervals([{ start: 0, end: 20 }, { start: 0, end: 20 }])).toThrow(/Overlapping/);
  });
});

describe("isActiveEvidence", () => {
  it("a retracted coach note remains historical but is not active evidence", () => {
    expect(
      isActiveEvidence({ noteId: "n1", text: "x", tentative: false, authoredBy: "coach", retracted: true, retractedAt: "2026-01-01" }),
    ).toBe(false);
  });

  it("a non-retracted note is active evidence", () => {
    expect(isActiveEvidence({ noteId: "n2", text: "x", tentative: false, authoredBy: "coach", retracted: false })).toBe(true);
  });
});

describe("describeConflict", () => {
  it("flags disagreeing source values as CONFLICT without picking a winner", () => {
    expect(describeConflict({ sourceId: "a", value: "6-4" }, { sourceId: "b", value: "5-4" })).toBe("CONFLICT");
  });

  it("agreeing source values are not a conflict", () => {
    expect(describeConflict({ sourceId: "a", value: "6-4" }, { sourceId: "b", value: "6-4" })).toBe("AGREEMENT");
  });
});
