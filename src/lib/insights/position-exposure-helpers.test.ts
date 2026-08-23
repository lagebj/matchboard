import { describe, it, expect } from "vitest";
import { incrementCount, topPosition, formatEvidenceCompleteness } from "./position-exposure-helpers";

describe("position-exposure-helpers", () => {
  it("increments a fresh key to 1", () => {
    const record: Record<string, number> = {};
    incrementCount(record, "GK");
    expect(record).toEqual({ GK: 1 });
  });

  it("increments an existing key", () => {
    const record: Record<string, number> = { GK: 2 };
    incrementCount(record, "GK");
    expect(record).toEqual({ GK: 3 });
  });

  it("returns the most frequent position", () => {
    expect(topPosition({ GK: 1, DEF: 5, MID: 3 })).toBe("DEF");
  });

  it("returns null for an empty record", () => {
    expect(topPosition({})).toBeNull();
  });

  it("formats a fraction as a rounded percentage", () => {
    expect(formatEvidenceCompleteness(0.5)).toBe("50%");
    expect(formatEvidenceCompleteness(1)).toBe("100%");
    expect(formatEvidenceCompleteness(0)).toBe("0%");
  });
});
