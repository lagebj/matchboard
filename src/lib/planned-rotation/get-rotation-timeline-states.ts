import type { TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";

/**
 * Rotations tab timeline node states (Touchline Design Atlas, `08_ROUTE_COMPOSITION_PLANNING_
 * TACTICS.md §D`: "exact chronological decision points" rendered via `TouchlineTimeline`). Pure,
 * DB-free -- derived entirely from each change's already-known `status`, in the existing plan
 * order (no re-sorting: `PlannedRotationPanel`'s own move-up/move-down reordering already
 * determines plan order).
 *
 * `APPLIED` -> "done". The first non-applied change in order -> "next" (the next decision point
 * a coach would act on). Every later non-applied change -> "later". This mirrors the same
 * current/next/later vocabulary Today's own `TodayOperationalTimeline` already uses for a
 * chronological plan.
 */
export interface RotationTimelineChangeInput {
  status: string;
}

export function computeRotationTimelineStates(changes: RotationTimelineChangeInput[]): TimelineNodeState[] {
  let nextAssigned = false;
  return changes.map((change) => {
    if (change.status === "APPLIED") return "done";
    if (!nextAssigned) {
      nextAssigned = true;
      return "next";
    }
    return "later";
  });
}
