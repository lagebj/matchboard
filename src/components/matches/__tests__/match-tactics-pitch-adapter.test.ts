import { describe, it, expect } from "vitest";
import {
  buildPlanningPitchAssignments,
  type TacticsPitchAssignmentInput,
  type TacticsPitchPlayerInput,
} from "../match-tactics-pitch-adapter";

/**
 * Atlas Follow-up Phase F7 (production pitch migration,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`): the pure mapping `MatchTacticsPanel` uses to
 * adapt canonical `MatchLineupAssignment` data into `TouchlinePlanningPitch`'s presentation
 * shape. Extracted specifically so this exact mapping is directly unit-testable — no E2E/
 * component test exercises the Tactics/Pitch tab at all (a genuine pre-existing gap).
 *
 * The `FormationSlot` → `PlanningPitchSlot` mapping is tested separately, alongside the shared
 * `buildPlanningPitchSlotsFromFormationSlots()` it reuses
 * (`src/components/touchline/pitch/__tests__/formation-slot-projection.test.ts`).
 */
describe("buildPlanningPitchAssignments", () => {
  const players: TacticsPitchPlayerInput[] = [
    { id: "p1", firstName: "Sander", lastName: "Berg" },
    { id: "p2", firstName: "Elias", lastName: null },
  ];

  it("filters out assignments with no playerId", () => {
    const assignments: TacticsPitchAssignmentInput[] = [
      { slotId: "s1", playerId: null, locked: false },
      { slotId: "s2", playerId: "p1", locked: false },
    ];
    const result = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result).toHaveLength(1);
    expect(result[0].slotId).toBe("s2");
  });

  it("formats a display name with last-name initial when lastName is present", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Sander B.");
  });

  it("formats a display name with first name only when lastName is null", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p2", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Elias");
  });

  it("falls back to 'Unknown' when the player is not found in the pool", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "missing", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Unknown");
  });

  it("passes the team kit colour through to every assignment", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, "#d5342c", null);
    expect(result.kitColor).toBe("#d5342c");
  });

  it("renders null kit colour as null (neutral shirt), not a fallback colour", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.kitColor).toBeNull();
  });

  it("marks an assignment locked when the underlying assignment is locked", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: true }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.locked).toBe(true);
  });

  it("marks exactly the assignment matching selectedPlayerId as selected", () => {
    const assignments: TacticsPitchAssignmentInput[] = [
      { slotId: "s1", playerId: "p1", locked: false },
      { slotId: "s2", playerId: "p2", locked: false },
    ];
    const result = buildPlanningPitchAssignments(assignments, players, null, "p2");
    expect(result.find((a) => a.slotId === "s1")?.selected).toBe(false);
    expect(result.find((a) => a.slotId === "s2")?.selected).toBe(true);
  });

  it("marks no assignment selected when selectedPlayerId is null", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.selected).toBe(false);
  });

  it("carries the real playerId through for callers that need it beyond display", () => {
    const assignments: TacticsPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.playerId).toBe("p1");
  });
});
