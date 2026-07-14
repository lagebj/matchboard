import { describe, it, expect } from "vitest";
import { checkCoreInvariants, applyCoreInvariants } from "../core-invariants";
import type { SelectionPolicyInput } from "../types";

function makeInput(overrides?: Partial<SelectionPolicyInput>): SelectionPolicyInput {
  return {
    context: {
      phase: "pre_selection",
      mode: "event",
      decisionType: "event_squad_generation",
      nowIso: "2026-01-01T00:00:00Z",
    },
    players: [],
    teams: [],
    squads: [],
    matches: [],
    history: { playerMatchCountMap: {}, playerRoleMap: {}, playerRecentSupportCount: {} },
    constraints: {},
    ...overrides,
  };
}

describe("checkCoreInvariants", () => {
  it("returns no violations for empty input", () => {
    const result = checkCoreInvariants(makeInput());
    expect(result).toEqual([]);
  });

  it("blocks removed players", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p1", displayName: "Removed Player", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("removed_player_cannot_be_selected");
    expect(result[0].playerId).toBe("p1");
  });

  it("blocks inactive players", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p2", displayName: "Inactive Player", status: "INACTIVE", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("inactive_player_cannot_be_selected");
  });

  it("blocks unavailable players who are not removed or inactive", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p3", displayName: "Sick Player", status: "ACTIVE", availableForContext: false, unavailableReason: "Sick", currentTeamIds: [] },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("unavailable_player_cannot_be_selected");
  });

  it("does not block removed players for unavailability (already blocked by status)", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p4", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("removed_player_cannot_be_selected");
  });

  it("detects duplicate player in squad", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p1", displayName: "Player 1", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        ],
        squads: [
          { id: "s1", playerIdList: ["p1", "p1"], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 0, anyGoalkeeperCount: 0 },
        ],
      }),
    );
    const dup = result.find((v) => v.rule === "duplicate_player_in_squad");
    expect(dup).toBeDefined();
    expect(dup!.playerId).toBe("p1");
  });

  it("allows active available players", () => {
    const result = checkCoreInvariants(
      makeInput({
        players: [
          { id: "p5", displayName: "Good Player", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        ],
      }),
    );
    expect(result).toHaveLength(0);
  });
});

describe("applyCoreInvariants", () => {
  it("produces allowed list excluding blocked players", () => {
    const result = applyCoreInvariants(
      makeInput({
        players: [
          { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
          { id: "p2", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result.allowedPlayerIds).toContain("p1");
    expect(result.allowedPlayerIds).not.toContain("p2");
    expect(result.blocked["p2"]).toContain("removed_player_cannot_be_selected");
    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0].code).toBe("removed_player_cannot_be_selected");
    expect(result.explanations[0].hardRule).toBe(true);
  });
});
