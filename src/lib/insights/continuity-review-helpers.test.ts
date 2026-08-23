import { describe, it, expect } from "vitest";
import { continuityRatio, formatFormationChange } from "./continuity-review-helpers";
import type { ContinuityRow } from "./insights-types";

function row(overrides: Partial<ContinuityRow>): ContinuityRow {
  return {
    teamId: "t1",
    teamName: "Team",
    matchRoundId: "r2",
    matchRoundLabel: "Round 2",
    previousMatchRoundId: "r1",
    retainedStarterCount: 0,
    newPlayerCount: 0,
    retainedFormation: null,
    formationName: null,
    previousFormationName: null,
    supportPlayerChanges: 0,
    ...overrides,
  };
}

describe("continuity-review-helpers", () => {
  it("computes the retained-player ratio", () => {
    expect(continuityRatio(row({ retainedStarterCount: 8, newPlayerCount: 2 }))).toBe(0.8);
  });

  it("returns null when there is no player data at all", () => {
    expect(continuityRatio(row({ retainedStarterCount: 0, newPlayerCount: 0 }))).toBeNull();
  });

  it("formats formation-change status", () => {
    expect(formatFormationChange(row({ retainedFormation: true }))).toBe("Repeated formation");
    expect(formatFormationChange(row({ retainedFormation: false }))).toBe("Changed formation");
    expect(formatFormationChange(row({ retainedFormation: null }))).toBe("No prior formation data");
  });
});
