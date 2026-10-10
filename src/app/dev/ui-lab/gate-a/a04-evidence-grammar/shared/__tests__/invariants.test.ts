import { describe, it, expect } from "vitest";
import {
  assertNonOverlappingIntervals,
  assertValidClosedInterval,
  assertUniqueIds,
  isActiveEvidence,
  describeConflict,
} from "../invariants";

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

/**
 * Independent review round 1 (PR #778): `assertNonOverlappingIntervals` alone accepted a
 * reversed or negative-duration interval as long as it didn't overlap anything else.
 */
describe("assertValidClosedInterval", () => {
  it("accepts a normal forward interval", () => {
    expect(() => assertValidClosedInterval({ start: 0, end: 20 })).not.toThrow();
  });

  it("rejects a negative start", () => {
    expect(() => assertValidClosedInterval({ start: -5, end: 10 })).toThrow(/nonnegative/);
  });

  it("rejects a reversed interval (end before start)", () => {
    expect(() => assertValidClosedInterval({ start: 20, end: 10 })).toThrow(/strictly after/);
  });

  it("rejects a zero-duration interval", () => {
    expect(() => assertValidClosedInterval({ start: 10, end: 10 })).toThrow(/strictly after/);
  });

  it("assertNonOverlappingIntervals rejects a reversed interval even though it would not overlap by start-order alone", () => {
    expect(() => assertNonOverlappingIntervals([{ start: 20, end: 10 }, { start: 30, end: 40 }])).toThrow(/strictly after/);
  });
});

describe("assertUniqueIds", () => {
  it("accepts distinct ids", () => {
    expect(() => assertUniqueIds(["a", "b", "c"])).not.toThrow();
  });

  it("rejects a duplicate id instead of silently double-counting it", () => {
    expect(() => assertUniqueIds(["a", "b", "a"], "round")).toThrow(/Duplicate round id "a"/);
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
