import { gridToNormalizedPoint } from "./projection";
import type { PlanningPitchSlot } from "./touchline-planning-pitch";
import type { FormationSlotRoleType } from "@/lib/formations/types";

/**
 * Shared `FormationSlot`-shaped grid data → `PlanningPitchSlot` mapping (Atlas Follow-up
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`). Every planning-pitch caller whose slots come from
 * `src/lib/formations/types.ts`'s `FormationSlot`/`FormationSlotData` shape (match lineup/tactics,
 * the Formations editor, event match lineup, …) shares this one mapping rather than re-deriving
 * it per caller — see AGENTS.md's "One business operation, one owning implementation" invariant.
 * Pure — no DOM, no DB — so it is directly unit-testable.
 */
export type FormationSlotGridInput = {
  id: string;
  gridX: number;
  gridY: number;
  shortLabel: string;
  roleType: FormationSlotRoleType;
};

export function buildPlanningPitchSlotsFromFormationSlots(slots: FormationSlotGridInput[]): PlanningPitchSlot[] {
  return slots.map((s) => ({
    id: s.id,
    point: gridToNormalizedPoint(s.gridX, s.gridY),
    roleLabel: s.shortLabel,
    isGoalkeeper: s.roleType === "GOALKEEPER",
  }));
}
