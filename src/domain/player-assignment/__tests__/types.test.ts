import { describe, it, expect } from "vitest";
import type { PlayerAssignmentBoard, PlayerAssignmentBoardPlayer, MovePlayerToTeamInput } from "../types";

describe("Player Assignment types", () => {
  it("PlayerAssignmentBoard has expected shape", () => {
    const board: PlayerAssignmentBoard = {
      teams: [],
      unassigned: [],
    };
    expect(board.teams).toEqual([]);
    expect(board.unassigned).toEqual([]);
  });

  it("PlayerAssignmentBoardPlayer has optional fields", () => {
    const player: PlayerAssignmentBoardPlayer = {
      playerId: "p1",
      displayName: "Test Player",
      rotatable: true,
      openIssueCount: 0,
    };
    expect(player.primaryPosition).toBeUndefined();
    expect(player.teamId).toBeUndefined();
    expect(player.coreGroup).toBeUndefined();
  });

  it("MovePlayerToTeamInput supports null targetTeamId", () => {
    const input: MovePlayerToTeamInput = {
      playerId: "p1",
      targetTeamId: null,
      reason: "Unassigning",
    };
    expect(input.targetTeamId).toBeNull();
  });

  it("MovePlayerToTeamInput supports targetTeamId with value", () => {
    const input: MovePlayerToTeamInput = {
      playerId: "p1",
      targetTeamId: "team-1",
      reason: "Reassigning",
    };
    expect(input.targetTeamId).toBe("team-1");
  });

  it("MovePlayerToTeamInput reason is optional", () => {
    const input: MovePlayerToTeamInput = {
      playerId: "p1",
      targetTeamId: "team-1",
    };
    expect(input.reason).toBeUndefined();
  });
});