import { describe, it, expect } from "vitest";
import { evaluateDefaultMatchboardPolicy } from "../default-matchboard-policy";
import type { SelectionPolicyInput } from "../types";

function makeInput(overrides?: Partial<SelectionPolicyInput>): SelectionPolicyInput {
  return {
    context: {
      phase: "pre_selection",
      mode: "event",
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

describe("evaluateDefaultMatchboardPolicy", () => {
  it("blocks removed players", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p1", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result.blocked["p1"]).toContain("removed_player_cannot_be_selected");
    expect(result.allowedPlayerIds).not.toContain("p1");
  });

  it("blocks inactive players", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p2", displayName: "Inactive", status: "INACTIVE", availableForContext: false, currentTeamIds: [] },
        ],
      }),
    );
    expect(result.blocked["p2"]).toContain("inactive_player_cannot_be_selected");
  });

  it("blocks unavailable players who are not removed or inactive", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p3", displayName: "Sick", status: "ACTIVE", availableForContext: false, unavailableReason: "Sick", currentTeamIds: [] },
        ],
      }),
    );
    expect(result.blocked["p3"]).toContain("unavailable_player_cannot_be_selected");
  });

  it("allows active available players", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p4", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        ],
      }),
    );
    expect(result.allowedPlayerIds).toContain("p4");
    expect(result.blocked["p4"]).toBeUndefined();
  });

  it("warns when squad has no goalkeeper coverage", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [],
        teams: [{ id: "t1", name: "Team A" }],
        squads: [{ id: "s1", teamId: "t1", playerIdList: [], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 0, anyGoalkeeperCount: 0 }],
      }),
    );
    const gkWarning = result.warnings.find((w) => w.code === "no_goalkeeper_coverage");
    expect(gkWarning).toBeDefined();
    expect(gkWarning!.severity).toBe("blocking");
  });

  it("warns with tertiary-only goalkeeper coverage", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [],
        teams: [{ id: "t1", name: "Team A" }],
        squads: [{ id: "s1", teamId: "t1", playerIdList: ["p1"], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 0, anyGoalkeeperCount: 1 }],
      }),
    );
    const gkWarning = result.warnings.find((w) => w.code === "no_primary_goalkeeper_tertiary_only");
    expect(gkWarning).toBeDefined();
    expect(gkWarning!.severity).toBe("warning");
  });

  it("warns with secondary-only goalkeeper coverage", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [],
        teams: [{ id: "t1", name: "Team A" }],
        squads: [{ id: "s1", teamId: "t1", playerIdList: ["p1"], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 1, anyGoalkeeperCount: 1 }],
      }),
    );
    const gkWarning = result.warnings.find((w) => w.code === "no_primary_goalkeeper_secondary_only");
    expect(gkWarning).toBeDefined();
    expect(gkWarning!.severity).toBe("warning");
  });

  it("produces score adjustments for low match counts", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p1", displayName: "Low Recent", status: "ACTIVE", availableForContext: true, recentMatchCount: 0, seasonMatchCount: 1, periodMatchCount: 1, currentTeamIds: [] },
        ],
      }),
    );
    const recentAdj = result.scoreAdjustments.find((a) => a.code === "low_recent_match_count");
    expect(recentAdj).toBeDefined();
    expect(recentAdj!.delta).toBe(5);
  });

  it("produces explanations for eligible players", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        players: [
          { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        ],
      }),
    );
    const eligible = result.explanations.find((e) => e.code === "eligible_active_available");
    expect(eligible).toBeDefined();
    expect(eligible!.playerId).toBe("p1");
  });

  it("warns on cancelled match", () => {
    const result = evaluateDefaultMatchboardPolicy(
      makeInput({
        matches: [{ id: "m1", isCancelled: true }],
      }),
    );
    const cancelled = result.warnings.find((w) => w.code === "match_cancelled");
    expect(cancelled).toBeDefined();
  });
});
