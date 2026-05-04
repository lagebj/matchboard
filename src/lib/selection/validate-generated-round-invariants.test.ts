import { describe, it, expect } from "vitest";
import { validateGeneratedRoundInvariants } from "@/lib/selection/validate-generated-round-invariants";
import type { RotationPathEdge } from "@/lib/selection/rotation-path-policy";
import type { GeneratedSelection, SelectedPlayer } from "@/lib/selection/types";

describe("validateGeneratedRoundInvariants", () => {
  const teamA = "team-a";
  const teamB = "team-b";
  const teamC = "team-c";

  const validPaths: RotationPathEdge[] = [
    { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", active: true },
    { fromTeamId: teamC, toTeamId: teamB, role: "DEVELOPMENT", active: true },
  ];

  function makePlayer(overrides: Partial<SelectedPlayer> & { playerId: string; coreTeamId: string; selectionCategory: string }): SelectedPlayer {
    return {
      autoSelected: true,
      eligibility: true,
      explanations: [],
      finalSelected: false,
      manualOverride: false,
      nonRotatable: false,
      playerName: "Player",
      playerPosition: "CM",
      coreTeamName: "Team",
      priorityScore: null,
      selectionReason: "",
      ...overrides,
    };
  }

  function makeSelection(selectedPlayers: SelectedPlayer[]): GeneratedSelection {
    return {
      matchId: "match-1",
      matchRoundId: "round-1",
      matchDate: new Date(),
      opponent: "Opponent",
      teamName: "Team B",
      selectedPlayers,
      excludedPlayers: [],
      generatedAt: new Date(),
      warnings: [],
    };
  }

  it("flags SUPPORT selection with no SUPPORT path", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamC,
        coreTeamName: "Team C",
        selectionCategory: "SUPPORT",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations.length).toBe(1);
    expect(violations[0]!.code).toBe("invariant_invalid_non_core_selection");
    expect(violations[0]!.severity).toBe("HARD_BLOCK");
    expect(violations[0]!.role).toBe("SUPPORT");
  });

  it("allows SUPPORT selection with valid SUPPORT path", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamA,
        coreTeamName: "Team A",
        selectionCategory: "SUPPORT",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations).toEqual([]);
  });

  it("skips CORE players — they don't need paths", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamB,
        coreTeamName: "Team B",
        selectionCategory: "CORE",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], [], teamIdByMatchId);
    expect(violations).toEqual([]);
  });

  it("skips manual overrides", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamC,
        coreTeamName: "Team C",
        selectionCategory: "SUPPORT",
        manualOverride: true,
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations).toEqual([]);
  });

  it("flags DEVELOPMENT selection when only SUPPORT path exists", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamA,
        coreTeamName: "Team A",
        selectionCategory: "DEVELOPMENT",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations.length).toBe(1);
    expect(violations[0]!.role).toBe("DEVELOPMENT");
  });

  it("allows DEVELOPMENT selection when DEVELOPMENT path exists", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamC,
        coreTeamName: "Team C",
        selectionCategory: "DEVELOPMENT",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations).toEqual([]);
  });

  it("flags BACKFILL selection when no BACKFILL path exists", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamA,
        coreTeamName: "Team A",
        selectionCategory: "BACKFILL",
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations.length).toBe(1);
    expect(violations[0]!.role).toBe("BACKFILL");
  });

  it("flags non-rotatable player selected in non-core role even when path exists", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamA,
        coreTeamName: "Team A",
        selectionCategory: "SUPPORT",
        nonRotatable: true,
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations.length).toBe(1);
    expect(violations[0]!.code).toBe("invariant_invalid_non_core_selection");
    expect(violations[0]!.severity).toBe("HARD_BLOCK");
    expect(violations[0]!.playerId).toBe("p1");
  });

  it("allows non-rotatable player in core role", () => {
    const teamIdByMatchId = new Map([["match-1", teamB]]);
    const selection = makeSelection([
      makePlayer({
        playerId: "p1",
        playerName: "Player 1",
        coreTeamId: teamB,
        coreTeamName: "Team B",
        selectionCategory: "CORE",
        nonRotatable: true,
      }),
    ]);

    const violations = validateGeneratedRoundInvariants([selection], validPaths, teamIdByMatchId);
    expect(violations).toEqual([]);
  });

  it("handles multiple selections across matches", () => {
    const teamIdByMatchId = new Map([["match-1", teamB], ["match-2", teamC]]);
    const selection1: GeneratedSelection = {
      ...makeSelection([]),
      matchId: "match-1",
      selectedPlayers: [
        makePlayer({
          playerId: "p1",
          playerName: "Player 1",
          coreTeamId: teamA,
          coreTeamName: "Team A",
          selectionCategory: "SUPPORT",
        }),
      ],
    };
    const selection2: GeneratedSelection = {
      ...makeSelection([]),
      matchId: "match-2",
      selectedPlayers: [
        makePlayer({
          playerId: "p2",
          playerName: "Player 2",
          coreTeamId: teamA,
          coreTeamName: "Team A",
          selectionCategory: "SUPPORT",
        }),
      ],
    };

    const violations = validateGeneratedRoundInvariants([selection1, selection2], validPaths, teamIdByMatchId);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.matchId).toBe("match-2");
  });
});