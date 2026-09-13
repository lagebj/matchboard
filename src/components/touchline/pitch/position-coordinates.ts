import { gridToNormalizedPoint } from "./projection";
import type { NormalizedPitchPoint } from "./types";

/**
 * Position-code → pitch-coordinate lookup for `TouchlinePositionMap`. Deliberately a fresh,
 * standalone copy of the same real-world mapping `src/components/ui/position-map.tsx`'s
 * `POSITION_GRID` already encodes — not imported from there, so the new canonical
 * `TouchlinePositionMap` has no dependency on the pre-Atlas-Follow-up `PositionMap`/`TacticsBoard`
 * chain that Phase F10 retires. Both tables describe the same formation grid
 * (`src/lib/formations/types.ts`'s `GRID_X_PERCENT`/`GRID_Y_PERCENT`) and must be kept in sync
 * until the old table is deleted.
 */
const POSITION_GRID: Record<string, { gridX: number; gridY: number }> = {
  GK: { gridX: 2, gridY: 5 },
  CB: { gridX: 2, gridY: 4 },
  LB: { gridX: 0, gridY: 4 },
  RB: { gridX: 4, gridY: 4 },
  CM: { gridX: 2, gridY: 2 },
  DM: { gridX: 2, gridY: 3 },
  AM: { gridX: 2, gridY: 1 },
  LM: { gridX: 0, gridY: 2 },
  WM: { gridX: 1, gridY: 1 },
  LW: { gridX: 0, gridY: 0 },
  RW: { gridX: 4, gridY: 0 },
  RM: { gridX: 4, gridY: 2 },
  W: { gridX: 1, gridY: 0 },
  ST: { gridX: 2, gridY: 0 },
  CF: { gridX: 2, gridY: 0 },
};

export function positionCodeToPoint(code: string): NormalizedPitchPoint | null {
  const cell = POSITION_GRID[code];
  if (!cell) return null;
  return gridToNormalizedPoint(cell.gridX, cell.gridY);
}
