import { describe, it, expect } from "vitest";
import { buildDeltaSummary } from "../delta-summary";

describe("buildDeltaSummary", () => {
  it("returns all planned players attended when everything matches", () => {
    expect(buildDeltaSummary(11, 11, 0, 0)).toBe("All planned players attended.");
  });

  it("reports planned-but-absent players", () => {
    const result = buildDeltaSummary(11, 10, 1, 0);
    expect(result).toContain("1 planned player did not attend");
  });

  it("reports unplanned participants", () => {
    const result = buildDeltaSummary(11, 11, 0, 1);
    expect(result).toContain("1 unplanned player participated");
  });

  it("reports planned vs actual count mismatch", () => {
    const result = buildDeltaSummary(11, 9, 0, 0);
    expect(result).toContain("11 planned vs 9 actual");
  });

  it("combines absent and unplanned counts", () => {
    const result = buildDeltaSummary(11, 9, 2, 1);
    expect(result).toContain("2 planned players did not attend");
    expect(result).toContain("1 unplanned player participated");
  });

  it("uses singular for single player", () => {
    const result = buildDeltaSummary(11, 10, 1, 1);
    expect(result).toContain("1 planned player did not attend");
    expect(result).toContain("1 unplanned player participated");
  });

  it("uses plural for multiple players", () => {
    const result = buildDeltaSummary(11, 9, 2, 3);
    expect(result).toContain("2 planned players did not attend");
    expect(result).toContain("3 unplanned players participated");
  });
});