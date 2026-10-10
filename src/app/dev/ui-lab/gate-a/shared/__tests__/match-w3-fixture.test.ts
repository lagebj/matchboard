import { describe, it, expect } from "vitest";
import {
  matchW3Squad,
  matchW3PlanningPitchSlots,
  matchW3PlanningPitchAssignments,
  withTacticalAssignment,
  MATCH_W3_UNFILLED_SLOT,
  MATCH_W3_PENDING_STARTER_PLAYER_ID,
  MATCH_W3_RESERVE_PLAYER_ID,
  MATCH_W3_TARGET_SQUAD_SIZE,
  MATCH_W3_CURRENT_SQUAD_SIZE,
  matchW3Identity,
  matchW3ClosedIdentity,
} from "../match-w3-fixture";

describe("Gate A W3 shared match fixture", () => {
  it("has 8 distinct squad members: 7 starters (6 slotted, 1 pending) and 1 bench reserve", () => {
    expect(new Set(matchW3Squad.map((m) => m.playerId)).size).toBe(matchW3Squad.length);
    expect(matchW3Squad).toHaveLength(8);
    expect(MATCH_W3_CURRENT_SQUAD_SIZE).toBe(8);

    const starters = matchW3Squad.filter((m) => m.role === "starter");
    const reserves = matchW3Squad.filter((m) => m.role === "reserve");
    expect(starters).toHaveLength(7);
    expect(reserves).toHaveLength(1);
    expect(reserves[0]?.playerId).toBe(MATCH_W3_RESERVE_PLAYER_ID);

    const slottedStarters = starters.filter((m) => m.tacticalPosition !== null);
    const pendingStarters = starters.filter((m) => m.tacticalPosition === null);
    expect(slottedStarters).toHaveLength(6);
    expect(pendingStarters).toHaveLength(1);
    expect(pendingStarters[0]?.playerId).toBe(MATCH_W3_PENDING_STARTER_PLAYER_ID);

    // The reserve is never provisionally slotted either.
    expect(reserves[0]?.tacticalPosition).toBeNull();
  });

  it("target squad size (9) is one more than the current 8-member squad", () => {
    expect(MATCH_W3_TARGET_SQUAD_SIZE).toBe(MATCH_W3_CURRENT_SQUAD_SIZE + 1);
  });

  it("no two squad members share a tactical slot, and the unfilled slot has no assignment", () => {
    const slots = matchW3Squad.map((m) => m.tacticalPosition).filter((p): p is NonNullable<typeof p> => p !== null);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots).not.toContain(MATCH_W3_UNFILLED_SLOT);
  });

  it("planning pitch slots and assignments never duplicate a slotId, and the unfilled RCM slot has no assignment", () => {
    const slots = matchW3PlanningPitchSlots();
    const assignments = matchW3PlanningPitchAssignments();
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    expect(new Set(assignments.map((a) => a.slotId)).size).toBe(assignments.length);
    expect(assignments.find((a) => a.slotId === `slot-${MATCH_W3_UNFILLED_SLOT}`)).toBeUndefined();
    expect(assignments).toHaveLength(6);
    // The bench reserve never appears on the pitch.
    expect(assignments.find((a) => a.playerId === MATCH_W3_RESERVE_PLAYER_ID)).toBeUndefined();
  });

  it("withTacticalAssignment locks the pending starter into the unfilled slot without touching any other member", () => {
    const proposed = withTacticalAssignment(matchW3Squad, MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT);
    const pendingStarter = proposed.find((m) => m.playerId === MATCH_W3_PENDING_STARTER_PLAYER_ID);
    expect(pendingStarter?.tacticalPosition).toBe(MATCH_W3_UNFILLED_SLOT);
    const assignments = matchW3PlanningPitchAssignments(proposed);
    expect(assignments).toHaveLength(7);
    expect(assignments.find((a) => a.slotId === `slot-${MATCH_W3_UNFILLED_SLOT}`)?.playerId).toBe(MATCH_W3_PENDING_STARTER_PLAYER_ID);
    // The reserve still never appears on the pitch, even after the pending starter is placed.
    expect(assignments.find((a) => a.playerId === MATCH_W3_RESERVE_PLAYER_ID)).toBeUndefined();
    // The original fixture array is untouched (pure reducer, no mutation).
    expect(matchW3Squad.find((m) => m.playerId === MATCH_W3_PENDING_STARTER_PLAYER_ID)?.tacticalPosition).toBeNull();
  });

  it("rejects assigning a player who is not a squad member — membership check happens before slot assignment", () => {
    expect(() => withTacticalAssignment(matchW3Squad, "player-not-in-squad", MATCH_W3_UNFILLED_SLOT)).toThrow(/not a squad member/);
  });

  it("the open and closed match identities share the same match id and kickoff, differing only in lifecycle", () => {
    expect(matchW3Identity.id).toBe(matchW3ClosedIdentity.id);
    expect(matchW3Identity.kickoffDate).toBe(matchW3ClosedIdentity.kickoffDate);
    expect(matchW3Identity.kickoffTime).toBe(matchW3ClosedIdentity.kickoffTime);
    expect(matchW3Identity.lifecycle).toBe("planning_open");
    expect(matchW3ClosedIdentity.lifecycle).toBe("planning_closed");
  });
});
