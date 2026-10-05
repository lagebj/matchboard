import { describe, expect, it } from "vitest";
import { computeTeamMetrics } from "../proposal-validation";
import type {
  CompositionPlayer,
  ProposedTeamAssignment,
  RoleSuitabilityProfile,
  RoleStrengthProfile,
  TeamStructuralRequirements,
} from "../team-composition-types";

function suit(): RoleSuitabilityProfile {
  return { goalkeeper: "NO_FIT", defence: "NO_FIT", midfield: "NO_FIT", attack: "NO_FIT", flexible: "PRIMARY" };
}
function strength(): RoleStrengthProfile {
  return { goalkeeper: null, defence: null, midfield: null, attack: null, flexible: null };
}
function player(id: string, primary: string): CompositionPlayer {
  return {
    id,
    displayName: id,
    overallStrength: 5,
    overallStrengthRated: true,
    available: true,
    active: true,
    goalkeeperAbility: primary === "GK" ? "YES" : "NO",
    roleSuitability: suit(),
    primaryBroadPosition: "flexible",
    roleStrength: strength(),
    declaredPrimaryPosition: primary,
    declaredSecondaryPosition: null,
    declaredTertiaryPosition: null,
    bestSide: "CENTER",
  };
}
function assign(playerId: string): ProposedTeamAssignment {
  return {
    playerId,
    teamId: "t1",
    assignedRole: "FLEXIBLE",
    assignedBroadPosition: "flexible",
    positionFit: "PRIMARY",
    source: "STRUCTURAL_ROLE",
    selectionReason: "test",
    overallStrength: 5,
    isGoalkeeper: false,
  };
}

// Normative grid (ADR-0154 §2): gridY 0=attack, 2=midfield, 4=defence, 5=goalkeeper.
const EXACT_STRUCTURE: TeamStructuralRequirements = {
  slots: [],
  requireGoalkeeper: true,
  source: "FORMATION",
  exactSlots: [
    { slotId: "gk", roleType: "GOALKEEPER", gridX: 2, gridY: 5 },
    { slotId: "lb", roleType: "DEFENDER", gridX: 0, gridY: 4 },
    { slotId: "rb", roleType: "DEFENDER", gridX: 4, gridY: 4 },
    { slotId: "cm", roleType: "MIDFIELDER", gridX: 2, gridY: 2 },
    { slotId: "st", roleType: "FORWARD", gridX: 2, gridY: 0 },
  ],
};

describe("computeTeamMetrics — exact formation coverage (ADR-0129 §12)", () => {
  it("is viable when the squad staffs every exact slot simultaneously", () => {
    const players = [player("g", "GK"), player("l", "LB"), player("r", "RB"), player("c", "CM"), player("s", "ST")];
    const metrics = computeTeamMetrics("t1", "Team 1", players.map((p) => assign(p.id)), players, EXACT_STRUCTURE);
    expect(metrics.formationViability).toBe("viable");
    expect(metrics.structuralWarnings.filter((w) => w.startsWith("No safe automatic fit"))).toEqual([]);
  });

  it("flags the exact unfilled role and is not viable when a slot cannot be staffed", () => {
    // No left-back and nobody eligible for LB (AM→LB is DEVELOPMENTAL).
    const players = [player("g", "GK"), player("am", "AM"), player("r", "RB"), player("c", "CM"), player("s", "ST")];
    const metrics = computeTeamMetrics("t1", "Team 1", players.map((p) => assign(p.id)), players, EXACT_STRUCTURE);
    expect(metrics.formationViability).not.toBe("viable");
    expect(metrics.structuralWarnings).toContain("No safe automatic fit for LB");
  });

  it("falls back to broad presence checks when the structure carries no exact slots", () => {
    const players = [player("g", "GK"), player("c", "CM")];
    const metrics = computeTeamMetrics("t1", "Team 1", players.map((p) => assign(p.id)), players, {
      slots: [],
      requireGoalkeeper: true,
      source: "FALLBACK",
    });
    // No exact-fit warnings when there are no exact slots.
    expect(metrics.structuralWarnings.some((w) => w.startsWith("No safe automatic fit"))).toBe(false);
  });
});
