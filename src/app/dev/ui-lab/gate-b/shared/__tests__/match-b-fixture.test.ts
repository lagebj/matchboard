import { describe, it, expect } from "vitest";
import { b01Squad, B01_EDIT_SLOT, B01_EDIT_CANDIDATE, withTacticalAssignment, b01OpponentMemory } from "../match-b-fixture";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

describe("withTacticalAssignment", () => {
  it("Sindre initially occupies LCM (precondition)", () => {
    const sindre = b01Squad.find((m) => m.displayName === "Sindre");
    expect(sindre?.tacticalPosition).toBe("LCM");
  });

  it("Vetle initially has no tactical position (precondition)", () => {
    const vetle = b01Squad.find((m) => m.playerId === B01_EDIT_CANDIDATE.playerId);
    expect(vetle?.tacticalPosition).toBeNull();
  });

  it("does not mutate the input squad", () => {
    const snapshot = JSON.parse(JSON.stringify(b01Squad));
    withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    expect(JSON.parse(JSON.stringify(b01Squad))).toEqual(snapshot);
  });

  it("assigns Vetle to LCM", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const vetle = result.find((m) => m.playerId === B01_EDIT_CANDIDATE.playerId);
    expect(vetle?.tacticalPosition).toBe("LCM");
  });

  it("removes Sindre from LCM", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const sindre = result.find((m) => m.displayName === "Sindre");
    expect(sindre?.tacticalPosition).toBeNull();
  });

  it("makes Sindre a reserve", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const sindre = result.find((m) => m.displayName === "Sindre");
    expect(sindre?.role).toBe("reserve");
  });

  it("makes Vetle a starter", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const vetle = result.find((m) => m.playerId === B01_EDIT_CANDIDATE.playerId);
    expect(vetle?.role).toBe("starter");
  });

  it("never produces duplicate occupancy — every occupied position is unique", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const occupied = result.filter((m) => m.tacticalPosition !== null).map((m) => m.tacticalPosition);
    expect(occupied.length).toBe(new Set(occupied).size);
  });

  it("keeps the lineup validly shaped — 7 occupied slots, 1 reserve", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    expect(result.filter((m) => m.tacticalPosition !== null)).toHaveLength(7);
    expect(result.filter((m) => m.role === "reserve")).toHaveLength(1);
  });

  it("leaves every unaffected squad member unchanged", () => {
    const result = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    for (const name of ["Oskar", "Theodor", "Markus", "Kasper", "Tobias", "Noah"]) {
      const before = b01Squad.find((m) => m.displayName === name);
      const after = result.find((m) => m.displayName === name);
      expect(after?.tacticalPosition).toBe(before?.tacticalPosition);
      expect(after?.role).toBe(before?.role);
    }
  });

  it("is idempotent — repeating the same assignment never reintroduces Sindre or duplicates Vetle", () => {
    const once = withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const twice = withTacticalAssignment(once, B01_EDIT_CANDIDATE.playerId, B01_EDIT_SLOT);
    const lcmOccupants = twice.filter((m) => m.tacticalPosition === "LCM");
    expect(lcmOccupants).toHaveLength(1);
    expect(lcmOccupants[0]?.playerId).toBe(B01_EDIT_CANDIDATE.playerId);
    expect(twice.find((m) => m.displayName === "Sindre")?.tacticalPosition).toBeNull();
  });

  it("throws for a player not in the squad", () => {
    expect(() => withTacticalAssignment(b01Squad, "player-does-not-exist", B01_EDIT_SLOT)).toThrow();
  });

  it("throws for a position outside the recognized tactical slots", () => {
    expect(() =>
      withTacticalAssignment(b01Squad, B01_EDIT_CANDIDATE.playerId, "NOT_A_REAL_SLOT" as CanonicalTacticalPosition),
    ).toThrow();
  });
});

// B1-R6: b01OpponentMemory previously claimed a tactical pressing pattern ("presses high in the
// first 15 minutes of every recorded meeting") backed only by result-only records.
describe("b01OpponentMemory (B1-R6 — no unsupported tactical claim)", () => {
  it("recentEncounters only contains result-only fields, never a smuggled tactical claim", () => {
    for (const encounter of b01OpponentMemory.recentEncounters) {
      expect(Object.keys(encounter).sort()).toEqual(["matchId", "occurredAt", "resultLabel"]);
    }
  });

  it("no pressing/tactical pattern claim is retained without a real observation source", () => {
    expect(b01OpponentMemory.patterns).toEqual([]);
  });
});
