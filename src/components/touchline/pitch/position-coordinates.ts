import { normalizeCanonicalPosition } from "@/domain/positions/canonical-aliases";
import { isCanonicalTacticalPosition } from "@/domain/positions/roles";
import { primaryDisplayCellFor, type GridCell } from "@/domain/positions/grid";
import { gridToNormalizedPoint } from "./projection";
import type { NormalizedPitchPoint } from "./types";

/**
 * Display cell for the broad historical concepts that can still flow through a position-code
 * string (`DEFENDER`/`MIDFIELDER`/`FORWARD`/`W`/`WM`, ADR-0154 §7) — they carry no left/right
 * precision to place more specifically, so they share the same central column the legacy table
 * used (DEFENDER/MIDFIELDER/FORWARD on the centre column at their depth; `W`/`WM` keep their
 * original placement). Not canonical tactical positions, never exact-eligibility authority.
 */
const BROAD_DISPLAY_CELL: Readonly<Record<string, GridCell>> = {
  DEFENDER: { gridX: 2, gridY: 4 },
  MIDFIELDER: { gridX: 2, gridY: 2 },
  FORWARD: { gridX: 2, gridY: 0 },
  W: { gridX: 1, gridY: 0 },
  WM: { gridX: 1, gridY: 1 },
};

/**
 * Position-code -> pitch grid cell, for `TouchlinePositionMap`/`PitchExposure`. A thin adapter
 * over the single domain position authority (ADR-0154 §4) — no independent lookup table
 * maintained here. Canonical codes (including legacy aliases like `DM`/`CDM`) resolve through
 * `normalizeCanonicalPosition` + `primaryDisplayCellFor`; broad codes use the fallback above;
 * anything else (unrecognized) returns `null` — never a placeholder/guessed cell.
 */
export function positionCodeToGridCell(code: string): GridCell | null {
  const canonical = normalizeCanonicalPosition(code);
  if (!canonical) return null;
  if (isCanonicalTacticalPosition(canonical)) return primaryDisplayCellFor(canonical);
  return BROAD_DISPLAY_CELL[canonical] ?? null;
}

export function positionCodeToPoint(code: string): NormalizedPitchPoint | null {
  const cell = positionCodeToGridCell(code);
  if (!cell) return null;
  return gridToNormalizedPoint(cell.gridX, cell.gridY);
}
