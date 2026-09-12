import { describe, it, expect } from "vitest";
import { computeEventSquadReadiness } from "../event-squad-readiness";

describe("computeEventSquadReadiness", () => {
  it("computes currentCount, hasGoalkeeper, and missingCount per squad", () => {
    const result = computeEventSquadReadiness([
      { id: "s1", name: "Rød", targetSize: 14, players: [{ isGK: true }, { isGK: false }] },
      { id: "s2", name: "Hvit", targetSize: 5, players: [{ isGK: false }, { isGK: false }, { isGK: false }] },
    ]);

    expect(result).toEqual([
      { squadId: "s1", squadName: "Rød", currentCount: 2, targetSize: 14, hasGoalkeeper: true, missingCount: 12 },
      { squadId: "s2", squadName: "Hvit", currentCount: 3, targetSize: 5, hasGoalkeeper: false, missingCount: 2 },
    ]);
  });

  it("clamps missingCount at 0 when a squad already meets or exceeds its target", () => {
    const result = computeEventSquadReadiness([
      { id: "s1", name: "Rød", targetSize: 10, players: Array.from({ length: 12 }, () => ({ isGK: false })) },
    ]);
    expect(result[0].missingCount).toBe(0);
  });

  it("returns an empty array for a squad with no players and reports the full target as missing", () => {
    const result = computeEventSquadReadiness([{ id: "s1", name: "Rød", targetSize: 10, players: [] }]);
    expect(result).toEqual([
      { squadId: "s1", squadName: "Rød", currentCount: 0, targetSize: 10, hasGoalkeeper: false, missingCount: 10 },
    ]);
  });
});
