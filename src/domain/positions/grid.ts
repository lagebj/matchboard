// ─────────────────────────────────────────────────────────────────
// Canonical 5×6 formation-slot grid (ADR-0154 §2/§3).
//
// gridX 0-4 (left→right), gridY 0-5 (attack→goalkeeper). A direct lookup
// table, never inference — no other exact tactical position can be derived
// from these cells. `LW`/`RW` are each one canonical position with two valid
// formation cells (y0 and y1); every other position has exactly one cell.
// ─────────────────────────────────────────────────────────────────

import { isValidGridX, isValidGridY } from "@/lib/formations/types";
import type { CanonicalTacticalPosition } from "./roles";

export type GridCell = { gridX: number; gridY: number };

/**
 * The normative grid table (ADR-0154 §2). Row index is gridY, column index is
 * gridX. `null` means the cell has no exact tactical position (every y5 cell
 * except x2).
 */
const GRID_TABLE: readonly (CanonicalTacticalPosition | null)[][] = [
  // y0 — attack
  ["LW", "LCF", "CF", "RCF", "RW"],
  // y1 — attacking midfield
  ["LW", "LAM", "CAM", "RAM", "RW"],
  // y2 — midfield
  ["LM", "LCM", "CM", "RCM", "RM"],
  // y3 — defensive midfield
  ["LWB", "LDM", "CDM", "RDM", "RWB"],
  // y4 — defence
  ["LB", "LCB", "CB", "RCB", "RB"],
  // y5 — goalkeeper
  [null, null, "GK", null, null],
];

/**
 * Direct lookup, not inference. Returns `null` for an out-of-range or
 * non-position cell (every y5 cell except x2=GK) — never guessed, never
 * clamped into range.
 */
export function canonicalPositionForCell(gridX: number, gridY: number): CanonicalTacticalPosition | null {
  if (!isValidGridX(gridX) || !isValidGridY(gridY)) return null;
  return GRID_TABLE[gridY]?.[gridX] ?? null;
}

/**
 * Every valid formation cell for a canonical position. One cell for every
 * position except `LW`/`RW`, which each have two (ADR-0154 §3).
 */
const VALID_FORMATION_CELLS: Readonly<Record<CanonicalTacticalPosition, readonly GridCell[]>> = (() => {
  const result: Record<string, GridCell[]> = {};
  for (let gridY = 0; gridY < GRID_TABLE.length; gridY++) {
    for (let gridX = 0; gridX < GRID_TABLE[gridY]!.length; gridX++) {
      const position = GRID_TABLE[gridY]![gridX];
      if (position === null) continue;
      (result[position] ??= []).push({ gridX, gridY });
    }
  }
  return result as unknown as Readonly<Record<CanonicalTacticalPosition, readonly GridCell[]>>;
})();

export function validFormationCellsFor(position: CanonicalTacticalPosition): readonly GridCell[] {
  return VALID_FORMATION_CELLS[position] ?? [];
}

/**
 * The deterministic single-point cell used for renderings that require one
 * point per position (e.g. a player-profile position map). `LW`/`RW` use their
 * forward cell (y0) — ADR-0154 §3's explicit choice, not the attacking-mid one.
 */
const PRIMARY_DISPLAY_CELL: Readonly<Record<CanonicalTacticalPosition, GridCell>> = Object.fromEntries(
  Object.entries(VALID_FORMATION_CELLS).map(([position, cells]) => [position, cells[0]!]),
) as Record<CanonicalTacticalPosition, GridCell>;

export function primaryDisplayCellFor(position: CanonicalTacticalPosition): GridCell {
  return PRIMARY_DISPLAY_CELL[position];
}
