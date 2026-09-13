import { GRID_X_PERCENT, GRID_Y_PERCENT, GRID_WIDTH, GRID_HEIGHT } from "@/lib/formations/types";
import type { NormalizedPitchPoint, ScreenPitchPoint } from "./types";

/**
 * Planning-pitch trapezoid tuning (Atlas Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md
 * §5`). "These are tuning ranges, not business data. The UI-lab golden gate decides the final
 * values." Centralized here, not hard-coded per call site.
 */
export const PLANNING_PITCH_PERSPECTIVE = {
  /** Visual width at the near (own-goal, bottom) edge, as a fraction of the pitch-surface box. */
  bottomWidthFraction: 1.0,
  /** Visual width at the far (attacking, top) edge — 84–90% per the contract; 85% reads clearly at UI-lab review while staying in range. */
  topWidthFraction: 0.85,
  /** Token scale near the own goal. */
  scaleNearGoal: 1.0,
  /** Token scale near the attacking goal — 0.90–0.94 per the contract; 0.9 is the low end, chosen for visibility. */
  scaleNearAttack: 0.9,
} as const;

/**
 * `src/lib/formations/types.ts`'s `GRID_X_PERCENT`/`GRID_Y_PERCENT` are canonical formation-slot
 * grid lookups (0-100 percent, `gridY: 0` = attacking line, `gridY: 5` = goalkeeper line — see
 * `docs/implementation/atlas-followup/pitch-inventory.md` §"Coordinate model detail"). This
 * adapter converts a discrete grid cell to the continuous `NormalizedPitchPoint` contract, so a
 * `FormationSlot`'s `{gridX, gridY}` and any future continuous coordinate share one projection
 * path. Does not replace or rewrite `FormationSlot` storage.
 */
export function gridToNormalizedPoint(gridX: number, gridY: number): NormalizedPitchPoint {
  const xPct = GRID_X_PERCENT[gridX] ?? 50;
  const yPct = GRID_Y_PERCENT[gridY] ?? 50;
  return {
    lateral: xPct / 100,
    // yPct is measured top-down (gridY 0 = attacking line = low yPct); longitudinal is
    // measured own-goal-up (0 = own goal), so it is the inverse.
    longitudinal: 1 - yPct / 100,
  };
}

export function normalizedPointToGrid(point: NormalizedPitchPoint): { gridX: number; gridY: number } {
  const xPct = point.lateral * 100;
  const yPct = (1 - point.longitudinal) * 100;
  let closestX = 0;
  let closestXDist = Infinity;
  for (let x = 0; x < GRID_WIDTH; x++) {
    const dist = Math.abs((GRID_X_PERCENT[x] ?? 50) - xPct);
    if (dist < closestXDist) {
      closestXDist = dist;
      closestX = x;
    }
  }
  let closestY = 0;
  let closestYDist = Infinity;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const dist = Math.abs((GRID_Y_PERCENT[y] ?? 50) - yPct);
    if (dist < closestYDist) {
      closestYDist = dist;
      closestY = y;
    }
  }
  return { gridX: closestX, gridY: closestY };
}

/**
 * The one canonical planning-pitch projection (contract §4/§5): normalizes a football
 * coordinate, then projects it into the visual pitch plane with a subtle trapezoid (top edge
 * narrower than bottom edge) and depth scale. Pure and deterministic — no DOM, no CSS transform.
 */
export function projectPlanningPitchPoint(point: NormalizedPitchPoint): ScreenPitchPoint {
  const { lateral, longitudinal } = point;
  const { bottomWidthFraction, topWidthFraction, scaleNearGoal, scaleNearAttack } = PLANNING_PITCH_PERSPECTIVE;

  const widthFraction = bottomWidthFraction - (bottomWidthFraction - topWidthFraction) * longitudinal;
  const xPct = 50 + (lateral - 0.5) * 100 * widthFraction;
  // longitudinal 0 (own goal) is the bottom edge (yPct 100); longitudinal 1 (attack) is the top edge (yPct 0).
  const yPct = 100 * (1 - longitudinal);
  const perspectiveScale = scaleNearGoal - (scaleNearGoal - scaleNearAttack) * longitudinal;

  return { xPct, yPct, perspectiveScale };
}

/**
 * `TouchlinePositionMap`'s flat, top-down projection (contract §7): the same football
 * orientation and lateral/longitudinal semantics, but no trapezoid and no depth scale — every
 * token renders at scale 1. A distinct function (not `projectPlanningPitchPoint` with the
 * perspective zeroed out) so the two canonical renderers can never accidentally share a tuning
 * knob that only one of them should have.
 */
export function projectFlatPitchPoint(point: NormalizedPitchPoint): ScreenPitchPoint {
  return {
    xPct: point.lateral * 100,
    yPct: 100 * (1 - point.longitudinal),
    perspectiveScale: 1,
  };
}
