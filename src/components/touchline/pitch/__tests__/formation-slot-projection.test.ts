import { describe, it, expect } from "vitest";
import { buildPlanningPitchSlotsFromFormationSlots, type FormationSlotGridInput } from "../formation-slot-projection";
import { gridToNormalizedPoint } from "../projection";

/**
 * Atlas Follow-up (`06_CANONICAL_PITCH_RENDERING_CONTRACT.md`): the shared `FormationSlot` →
 * `PlanningPitchSlot` mapping, reused by every planning-pitch caller whose slots come from
 * `FormationSlot`/`FormationSlotData` — the match Lineup/Tactics tab
 * (`match-tactics-pitch-adapter.ts`) and the Formations editor (`formations-builder.tsx`) both
 * share this one implementation rather than re-deriving it.
 */
describe("buildPlanningPitchSlotsFromFormationSlots", () => {
  it("resolves each slot's grid position via gridToNormalizedPoint", () => {
    const input: FormationSlotGridInput[] = [
      { id: "cb1", gridX: 1, gridY: 4, shortLabel: "CB", roleType: "DEFENDER" },
    ];
    const result = buildPlanningPitchSlotsFromFormationSlots(input);
    expect(result).toEqual([
      {
        id: "cb1",
        point: gridToNormalizedPoint(1, 4),
        roleLabel: "CB",
        isGoalkeeper: false,
      },
    ]);
  });

  it("marks a GOALKEEPER roleType slot as isGoalkeeper", () => {
    const input: FormationSlotGridInput[] = [
      { id: "gk", gridX: 2, gridY: 5, shortLabel: "GK", roleType: "GOALKEEPER" },
    ];
    const [slot] = buildPlanningPitchSlotsFromFormationSlots(input);
    expect(slot.isGoalkeeper).toBe(true);
  });

  it("does not mark a non-goalkeeper roleType as isGoalkeeper", () => {
    const input: FormationSlotGridInput[] = [
      { id: "st", gridX: 2, gridY: 0, shortLabel: "ST", roleType: "FORWARD" },
    ];
    const [slot] = buildPlanningPitchSlotsFromFormationSlots(input);
    expect(slot.isGoalkeeper).toBe(false);
  });

  it("preserves slot order and maps every slot", () => {
    const input: FormationSlotGridInput[] = [
      { id: "a", gridX: 0, gridY: 0, shortLabel: "A", roleType: "FORWARD" },
      { id: "b", gridX: 1, gridY: 1, shortLabel: "B", roleType: "MIDFIELDER" },
      { id: "c", gridX: 2, gridY: 2, shortLabel: "C", roleType: "DEFENDER" },
    ];
    const result = buildPlanningPitchSlotsFromFormationSlots(input);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("uses the exact shortLabel as roleLabel, unmodified", () => {
    const input: FormationSlotGridInput[] = [
      { id: "free1", gridX: 2, gridY: 3, shortLabel: "FREE", roleType: "FREE" },
    ];
    const [slot] = buildPlanningPitchSlotsFromFormationSlots(input);
    expect(slot.roleLabel).toBe("FREE");
  });
});
