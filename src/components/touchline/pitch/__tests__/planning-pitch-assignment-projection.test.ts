import { describe, it, expect } from "vitest";
import {
  buildPlanningPitchAssignments,
  type PlanningPitchAssignmentInput,
  type PlanningPitchPlayerInput,
} from "../planning-pitch-assignment-projection";

/**
 * Atlas Follow-up Phase F7 (production pitch migration,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`): the shared player-assignment →
 * `PlanningPitchAssignment` mapping, reused by every planning-pitch caller that places players
 * into slots — the match Lineup/Tactics tab (`match-tactics-panel.tsx`) and the Event match
 * lineup panel (`event-match-lineup-panel.tsx`) both share this one implementation rather than
 * re-deriving it.
 */
describe("buildPlanningPitchAssignments", () => {
  const players: PlanningPitchPlayerInput[] = [
    { id: "p1", firstName: "Sander", lastName: "Berg" },
    { id: "p2", firstName: "Elias", lastName: null },
  ];

  it("filters out assignments with no playerId", () => {
    const assignments: PlanningPitchAssignmentInput[] = [
      { slotId: "s1", playerId: null, locked: false },
      { slotId: "s2", playerId: "p1", locked: false },
    ];
    const result = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result).toHaveLength(1);
    expect(result[0].slotId).toBe("s2");
  });

  it("formats a display name with last-name initial when lastName is present", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Sander B.");
  });

  it("formats a display name with first name only when lastName is null", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p2", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Elias");
  });

  it("falls back to 'Unknown' when the player is not found in the pool", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "missing", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.name).toBe("Unknown");
  });

  it("passes the team kit colour through to every assignment", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, "#d5342c", null);
    expect(result.kitColor).toBe("#d5342c");
  });

  it("renders null kit colour as null (neutral shirt), not a fallback colour — the Event lineup panel always passes null since squads have no kit colour concept", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.kitColor).toBeNull();
  });

  it("marks an assignment locked when the underlying assignment is locked", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: true }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.locked).toBe(true);
  });

  it("marks exactly the assignment matching selectedPlayerId as selected", () => {
    const assignments: PlanningPitchAssignmentInput[] = [
      { slotId: "s1", playerId: "p1", locked: false },
      { slotId: "s2", playerId: "p2", locked: false },
    ];
    const result = buildPlanningPitchAssignments(assignments, players, null, "p2");
    expect(result.find((a) => a.slotId === "s1")?.selected).toBe(false);
    expect(result.find((a) => a.slotId === "s2")?.selected).toBe(true);
  });

  it("marks no assignment selected when selectedPlayerId is null", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.selected).toBe(false);
  });

  it("carries the real playerId through for callers that need it beyond display", () => {
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "p1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, players, null, null);
    expect(result.playerId).toBe("p1");
  });

  it("uses a Player's displayName (GuestPlayer-style, single-field) name as-is when lastName is null", () => {
    const displayNamePlayers: PlanningPitchPlayerInput[] = [{ id: "guest1", firstName: "Noah Berg", lastName: null }];
    const assignments: PlanningPitchAssignmentInput[] = [{ slotId: "s1", playerId: "guest1", locked: false }];
    const [result] = buildPlanningPitchAssignments(assignments, displayNamePlayers, null, null);
    expect(result.name).toBe("Noah Berg");
  });
});
