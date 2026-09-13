import { cn } from "@/lib/cn";
import { PlanningPitchMarkings } from "./pitch-markings";
import { projectPlanningPitchPoint, gridToNormalizedPoint } from "./projection";
import { PitchShirtToken, PitchEmptySlot } from "./pitch-shirt-token";
import type { NormalizedPitchPoint, PitchShirtTokenStatus } from "./types";

/**
 * `TouchlinePlanningPitch` — the one canonical planning-pitch renderer (Atlas Follow-up,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`). Used for Lineup, Tactics, Formations, formation
 * previews/editors, match/event planning, Round Board pitch subviews, and any other view where
 * actual/planned players are placed on a pitch (contract §1).
 *
 * Consumes geometry/slots/assignment presentation state and interaction callbacks only — it does
 * not decide lineup selection policy, evidence, fairness, or formation eligibility (contract's
 * "Pitch component model", `08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §7`). Callers resolve a
 * `FormationSlot`'s `{gridX, gridY}` via `gridToNormalizedPoint()` before passing `slots`, or pass
 * a continuous `NormalizedPitchPoint` directly for a non-formation-grid context.
 */
export type PlanningPitchSlot = {
  id: string;
  /** Either a continuous point, or `{gridX, gridY}` from `FormationSlot` (resolved via `gridToNormalizedPoint`). */
  point: NormalizedPitchPoint;
  /** Exact role/position code shown on an empty slot and beneath an assigned player, e.g. "CB". */
  roleLabel: string;
  isGoalkeeper?: boolean;
};

export type PlanningPitchAssignment = {
  slotId: string;
  name: string;
  number?: string | number | null;
  /** Resolved kit-colour hex — see `resolveKitColorSwatch()`. `null` renders the neutral shirt. */
  kitColor?: string | null;
  locked?: boolean;
  selected?: boolean;
  status?: PitchShirtTokenStatus;
};

export type TouchlinePlanningPitchProps = {
  slots: PlanningPitchSlot[];
  assignments: PlanningPitchAssignment[];
  /** An empty slot is clickable to assign only when this is provided and the slot is not read-only. */
  onSlotClick?: (slotId: string) => void;
  /** Fired on any slot click regardless of edit capability — for a read-only "view details" inspector (mirrors `TacticsBoard`'s `onSlotView`). */
  onSlotView?: (slotId: string, assignment: PlanningPitchAssignment | null) => void;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
};

export function TouchlinePlanningPitch({
  slots,
  assignments,
  onSlotClick,
  onSlotView,
  readOnly = false,
  compact = false,
  className,
}: TouchlinePlanningPitchProps) {
  const assignmentBySlot = new Map(assignments.map((a) => [a.slotId, a]));

  return (
    <div
      data-testid="touchline-planning-pitch"
      className={cn(
        "tl-pitch-surface relative w-full overflow-hidden aspect-[4/5]",
        className,
      )}
    >
      <PlanningPitchMarkings />
      {slots.map((slot) => {
        const assignment = assignmentBySlot.get(slot.id) ?? null;
        const screen = projectPlanningPitchPoint(slot.point);
        const canEdit = !readOnly && Boolean(onSlotClick);
        const handleClick = () => {
          if (canEdit) onSlotClick?.(slot.id);
          onSlotView?.(slot.id, assignment);
        };
        const canInteract = canEdit || Boolean(onSlotView);

        return (
          <div
            key={slot.id}
            className="absolute z-10"
            style={{
              left: `${screen.xPct}%`,
              top: `${screen.yPct}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {assignment ? (
              <PitchShirtToken
                name={assignment.name}
                role={slot.roleLabel}
                number={assignment.number}
                kitColor={assignment.kitColor}
                locked={assignment.locked}
                selected={assignment.selected}
                status={assignment.status}
                isGoalkeeper={slot.isGoalkeeper}
                perspectiveScale={screen.perspectiveScale}
                compact={compact}
                onClick={canInteract ? handleClick : undefined}
              />
            ) : (
              <PitchEmptySlot
                role={slot.roleLabel}
                editable={canEdit}
                compact={compact}
                onClick={canInteract ? handleClick : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { gridToNormalizedPoint };
