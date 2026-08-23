import { describe, it, expect } from "vitest";
import { sortByGapDescending, hasAnyGap } from "./opportunity-gap-helpers";
import type { OpportunityGapRow } from "./insights-types";

function row(overrides: Partial<OpportunityGapRow>): OpportunityGapRow {
  return {
    playerId: "p1",
    playerName: "Test Player",
    coreTeamId: "t1",
    coreTeamName: "Team",
    plannedOpportunities: 0,
    realisedOpportunities: 0,
    gap: 0,
    unavailableRounds: 0,
    cancelledMatches: 0,
    helperElsewhereCount: 0,
    noShowCount: 0,
    unknownAttendanceCount: 0,
    ...overrides,
  };
}

describe("opportunity-gap-helpers", () => {
  it("sorts by gap descending", () => {
    const rows = [row({ playerId: "a", gap: 1 }), row({ playerId: "b", gap: 5 }), row({ playerId: "c", gap: 3 })];
    expect(sortByGapDescending(rows).map((r) => r.playerId)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ playerId: "a", gap: 1 }), row({ playerId: "b", gap: 5 })];
    sortByGapDescending(rows);
    expect(rows.map((r) => r.playerId)).toEqual(["a", "b"]);
  });

  it("hasAnyGap is true only for a positive gap", () => {
    expect(hasAnyGap(row({ gap: 1 }))).toBe(true);
    expect(hasAnyGap(row({ gap: 0 }))).toBe(false);
    expect(hasAnyGap(row({ gap: -1 }))).toBe(false);
  });
});
