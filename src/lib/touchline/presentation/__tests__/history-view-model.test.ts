import { describe, it, expect } from "vitest";
import { buildHistoryViewModel, computeLoadRange, type HistoryPlayerRowInput } from "../history-view-model";

function player(overrides: Partial<HistoryPlayerRowInput> & { playerId: string }): HistoryPlayerRowInput {
  return {
    playerName: "Player",
    coreTeamName: "Rød",
    roundsPlayed: 0,
    totalSelections: 0,
    coreMatches: 0,
    supportMatches: 0,
    developmentMatches: 0,
    backfillMatches: 0,
    doubleLoadRounds: 0,
    droppedRounds: 0,
    unavailableRounds: 0,
    ...overrides,
  };
}

describe("buildHistoryViewModel", () => {
  it("sums totals across players for the summary strip", () => {
    const vm = buildHistoryViewModel({
      players: [
        player({ playerId: "1", totalSelections: 10, coreMatches: 6, supportMatches: 3, developmentMatches: 1 }),
        player({ playerId: "2", totalSelections: 5, coreMatches: 5 }),
      ],
      movementPaths: [],
      recentMovements: [],
      finalizedRoundCount: 8,
      draftRoundCount: 2,
    });

    expect(vm.summary.totalFinalizedAppearances).toBe(15);
    expect(vm.summary.totalSupportAppearances).toBe(3);
    expect(vm.summary.totalDevelopmentAppearances).toBe(1);
    expect(vm.summary.playersWithMovement).toBe(1);
    expect(vm.summary.finalizedRoundCount).toBe(8);
    expect(vm.summary.draftRoundCount).toBe(2);
  });

  it("buckets appearance distribution deterministically", () => {
    const vm = buildHistoryViewModel({
      players: [
        player({ playerId: "1", totalSelections: 0 }),
        player({ playerId: "2", totalSelections: 2 }),
        player({ playerId: "3", totalSelections: 5 }),
        player({ playerId: "4", totalSelections: 9 }),
        player({ playerId: "5", totalSelections: 12 }),
      ],
      movementPaths: [],
      recentMovements: [],
      finalizedRoundCount: 0,
      draftRoundCount: 0,
    });
    expect(vm.appearanceDistribution).toEqual([
      { label: "0", count: 1 },
      { label: "1–3", count: 1 },
      { label: "4–6", count: 1 },
      { label: "7–10", count: 1 },
      { label: "11+", count: 1 },
    ]);
  });

  it("passes through movement paths and recent movements unchanged (no re-derivation)", () => {
    const movementPaths = [{ fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", count: 3, uniquePlayers: 2, lastUsed: null }];
    const recentMovements = [{ playerId: "1", playerName: "Noah", matchRoundName: "W34", matchDate: null, teamName: "Rød", role: "SUPPORT" }];
    const vm = buildHistoryViewModel({
      players: [],
      movementPaths,
      recentMovements,
      finalizedRoundCount: 0,
      draftRoundCount: 0,
    });
    expect(vm.movementPaths).toBe(movementPaths);
    expect(vm.recentMovements).toBe(recentMovements);
  });

  it("returns a null load range for an empty player set", () => {
    const vm = buildHistoryViewModel({ players: [], movementPaths: [], recentMovements: [], finalizedRoundCount: 0, draftRoundCount: 0 });
    expect(vm.loadRange).toBeNull();
  });
});

describe("computeLoadRange", () => {
  it("computes min/median/max for an odd-length array", () => {
    expect(computeLoadRange([3, 1, 2])).toEqual({ min: 1, median: 2, max: 3 });
  });

  it("computes the average of the two middle values for an even-length array", () => {
    expect(computeLoadRange([1, 2, 3, 4])).toEqual({ min: 1, median: 2.5, max: 4 });
  });

  it("returns null for an empty array", () => {
    expect(computeLoadRange([])).toBeNull();
  });
});
