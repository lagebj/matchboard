import { describe, it, expect } from "vitest";
import { computeSimulationFairness, detectGkCoverageGaps } from "../simulation-fairness";
import type { PlayerSimulationParticipation } from "../simulation-types";

function makePlayer(overrides: Partial<PlayerSimulationParticipation>): PlayerSimulationParticipation {
  return {
    playerId: "player_1",
    playerName: "Player 1",
    coreTeamId: "team_blue",
    plannedRounds: 0,
    coreAssignments: 0,
    supportAssignments: 0,
    developmentAssignments: 0,
    squadRepairAssignments: 0,
    notSelectedRounds: 0,
    unavailableRounds: 0,
    roundsWithOpportunity: 0,
    ...overrides,
  };
}

describe("computeSimulationFairness", () => {
  it("returns empty summary for no players", () => {
    const result = computeSimulationFairness([], 3);

    expect(result.totalPlayers).toBe(0);
    expect(result.playersWithZeroOpportunity).toBe(0);
    expect(result.playersWithLowParticipation).toBe(0);
    expect(result.playersWithHighLoad).toBe(0);
    expect(result.playersWithEligibleNotSelected).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it("flags players with zero planned opportunity", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 3, unavailableRounds: 0 }),
      makePlayer({ playerId: "p2", playerName: "Bob", plannedRounds: 0, unavailableRounds: 0, notSelectedRounds: 3 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.playersWithZeroOpportunity).toBe(1);
    const zeroFlags = result.flags.filter((f) => f.flag === "zero_planned_opportunity");
    expect(zeroFlags).toHaveLength(1);
    expect(zeroFlags[0].playerId).toBe("p2");
  });

  it("does not flag unavailable players as zero opportunity", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 3, unavailableRounds: 0 }),
      makePlayer({ playerId: "p2", playerName: "Bob", plannedRounds: 0, unavailableRounds: 3, notSelectedRounds: 0 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    const zeroFlags = result.flags.filter((f) => f.flag === "zero_planned_opportunity");
    expect(zeroFlags).toHaveLength(0);
  });

  it("flags low period participation", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 5, coreAssignments: 5 }),
      makePlayer({ playerId: "p2", playerName: "Bob", plannedRounds: 1, coreAssignments: 1, unavailableRounds: 0 }),
    ];

    const result = computeSimulationFairness(participation, 5);

    expect(result.playersWithLowParticipation).toBeGreaterThanOrEqual(1);
    const lowFlags = result.flags.filter((f) => f.flag === "low_period_participation");
    expect(lowFlags.some((f) => f.playerId === "p2")).toBe(true);
  });

  it("flags high recent load (support burden)", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 3, coreAssignments: 3, supportAssignments: 0 }),
      makePlayer({ playerId: "p2", playerName: "Bob", plannedRounds: 3, coreAssignments: 0, supportAssignments: 3 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    const highLoadFlags = result.flags.filter((f) => f.flag === "high_recent_load");
    expect(highLoadFlags.some((f) => f.playerId === "p2")).toBe(true);
  });

  it("flags eligible but not selected players", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 3, unavailableRounds: 0, notSelectedRounds: 0 }),
      makePlayer({ playerId: "p2", playerName: "Bob", plannedRounds: 0, unavailableRounds: 0, notSelectedRounds: 3 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    const eligibleFlags = result.flags.filter((f) => f.flag === "eligible_not_selected");
    expect(eligibleFlags.some((f) => f.playerId === "p2")).toBe(true);
  });

  it("flags consecutive support burden", () => {
    const participation = [
      makePlayer({ playerId: "p1", playerName: "Alice", plannedRounds: 3, coreAssignments: 0, supportAssignments: 2 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    const burdenFlags = result.flags.filter((f) => f.flag === "consecutive_support_burden");
    expect(burdenFlags.some((f) => f.playerId === "p1")).toBe(true);
  });

  it("handles all players having equal participation", () => {
    const participation = [
      makePlayer({ playerId: "p1", plannedRounds: 3, coreAssignments: 3, unavailableRounds: 0, notSelectedRounds: 0 }),
      makePlayer({ playerId: "p2", plannedRounds: 3, coreAssignments: 3, unavailableRounds: 0, notSelectedRounds: 0 }),
      makePlayer({ playerId: "p3", plannedRounds: 3, coreAssignments: 3, unavailableRounds: 0, notSelectedRounds: 0 }),
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.playersWithZeroOpportunity).toBe(0);
    expect(result.playersWithHighLoad).toBe(0);
  });
});

describe("detectGkCoverageGaps", () => {
  it("flags rounds with no goalkeepers", () => {
    const participation: PlayerSimulationParticipation[] = [];
    const goalkeepersPerRound = { round_1: 0, round_2: 1, round_3: 0 };

    const flags = detectGkCoverageGaps(participation, goalkeepersPerRound);

    expect(flags).toHaveLength(2);
    expect(flags.every((f) => f.flag === "gk_coverage_gap")).toBe(true);
  });

  it("returns no flags when all rounds have GKs", () => {
    const participation: PlayerSimulationParticipation[] = [];
    const goalkeepersPerRound = { round_1: 1, round_2: 2, round_3: 1 };

    const flags = detectGkCoverageGaps(participation, goalkeepersPerRound);

    expect(flags).toHaveLength(0);
  });

  it("flags rounds below minimum GK threshold", () => {
    const participation: PlayerSimulationParticipation[] = [];
    const goalkeepersPerRound = { round_1: 1, round_2: 0 };

    const flags = detectGkCoverageGaps(participation, goalkeepersPerRound, 1);

    expect(flags).toHaveLength(1);
    expect(flags[0].flag).toBe("gk_coverage_gap");
  });
});