import { describe, it, expect } from "vitest";
import {
  computeSimulationFairness,
  detectGkCoverageGaps,
} from "@/lib/simulation/simulation-fairness";
import { detectSimulationConflicts } from "@/lib/simulation/simulation-conflicts";
import type { PlayerSimulationParticipation } from "@/lib/simulation/simulation-types";

describe("Simulation fairness computation", () => {
  it("flags players with zero opportunity", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 0,
        coreAssignments: 0,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 3,
        unavailableRounds: 0,
        roundsWithOpportunity: 0,
      },
      {
        playerId: "p2",
        playerName: "Player 2",
        coreTeamId: "t1",
        plannedRounds: 3,
        coreAssignments: 3,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 3,
      },
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.totalPlayers).toBe(2);
    expect(result.playersWithZeroOpportunity).toBe(1);
    expect(result.flags.some((f) => f.flag === "zero_planned_opportunity" && f.playerId === "p1")).toBe(true);
  });

  it("flags players with low participation", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 1,
        coreAssignments: 1,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 4,
        unavailableRounds: 0,
        roundsWithOpportunity: 1,
      },
      {
        playerId: "p2",
        playerName: "Player 2",
        coreTeamId: "t1",
        plannedRounds: 4,
        coreAssignments: 4,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 1,
        unavailableRounds: 0,
        roundsWithOpportunity: 4,
      },
    ];

    const result = computeSimulationFairness(participation, 5);

    expect(result.playersWithLowParticipation).toBe(1);
    expect(result.flags.some((f) => f.flag === "low_period_participation")).toBe(true);
  });

  it("flags players with high support load", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 5,
        coreAssignments: 3,
        supportAssignments: 3,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 5,
      },
      {
        playerId: "p2",
        playerName: "Player 2",
        coreTeamId: "t1",
        plannedRounds: 3,
        coreAssignments: 3,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 3,
      },
    ];

    const result = computeSimulationFairness(participation, 5);

    expect(result.flags.some((f) => f.flag === "high_recent_load" && f.playerId === "p1")).toBe(true);
  });

  it("flags consecutive support burden", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 3,
        coreAssignments: 0,
        supportAssignments: 3,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 3,
      },
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.flags.some((f) => f.flag === "consecutive_support_burden" && f.playerId === "p1")).toBe(true);
  });

  it("flags eligible but not selected players", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 0,
        coreAssignments: 0,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 3,
        unavailableRounds: 0,
        roundsWithOpportunity: 0,
      },
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.flags.some((f) => f.flag === "eligible_not_selected" && f.playerId === "p1")).toBe(true);
  });

  it("returns empty flags for balanced participation", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 3,
        coreAssignments: 2,
        supportAssignments: 1,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 3,
      },
      {
        playerId: "p2",
        playerName: "Player 2",
        coreTeamId: "t1",
        plannedRounds: 3,
        coreAssignments: 2,
        supportAssignments: 1,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 3,
      },
    ];

    const result = computeSimulationFairness(participation, 3);

    expect(result.playersWithZeroOpportunity).toBe(0);
    expect(result.playersWithLowParticipation).toBe(0);
    expect(result.playersWithHighLoad).toBe(0);
  });

  it("returns empty result for zero players", () => {
    const result = computeSimulationFairness([], 3);

    expect(result.totalPlayers).toBe(0);
    expect(result.flags).toHaveLength(0);
  });
});

describe("GK coverage gap detection", () => {
  it("detects rounds with no goalkeeper", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 1,
        coreAssignments: 1,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 1,
      },
    ];

    const gkPerRound: Record<string, number> = { round1: 0 };

    const flags = detectGkCoverageGaps(participation, gkPerRound);

    expect(flags.some((f) => f.flag === "gk_coverage_gap")).toBe(true);
  });

  it("returns no flags when GK coverage is adequate", () => {
    const participation: PlayerSimulationParticipation[] = [
      {
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: "t1",
        plannedRounds: 1,
        coreAssignments: 1,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
        roundsWithOpportunity: 1,
      },
    ];

    const gkPerRound: Record<string, number> = { round1: 1 };

    const flags = detectGkCoverageGaps(participation, gkPerRound);

    expect(flags).toHaveLength(0);
  });
});

describe("Simulation conflict detection", () => {
  it("detects player overuse in same week", () => {
    const conflicts = detectSimulationConflicts([
      {
        playerId: "p1",
        leagueAssignments: [],
        eventAssignments: [],
        totalAssignments: 3,
      },
    ]);

    expect(conflicts.some((c) => c.type === "player_overuse_same_week")).toBe(true);
  });

  it("returns no conflicts for players within limits", () => {
    const conflicts = detectSimulationConflicts([
      {
        playerId: "p1",
        leagueAssignments: [],
        eventAssignments: [],
        totalAssignments: 1,
      },
    ]);

    expect(conflicts).toHaveLength(0);
  });

  it("returns no conflicts for empty input", () => {
    const conflicts = detectSimulationConflicts([]);
    expect(conflicts).toHaveLength(0);
  });
});