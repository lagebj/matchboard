import { primaryDisplayCellFor, validFormationCellsFor, type GridCell } from "@/domain/positions/grid";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

/**
 * A06 UI Lab candidate-only presentation override (owner visual feedback, 2026-10-09): "A06 24
 * point positions should have LW and RW on Attacking midfielder horizontal similar to 14 point
 * position. GK and F are always central."
 *
 * Production's `primaryDisplayCellFor` (`src/domain/positions/grid.ts`, ADR-0154 §3) deliberately
 * picks the y0 (attack) cell for `LW`/`RW`'s single-point display — that function, the canonical
 * grid table, `position-coordinates.ts`, and the production `TouchlinePositionMap` component are
 * all untouched by this override. This module only decides which of a position's already-real,
 * already-valid formation cells THIS CANDIDATE's own renderer uses — `LW`/`RW` move to their real
 * y1 (attacking-midfield) cell instead, matching the 14-point profile view's `LW`/`AM`/`RW`
 * grouping. No other position's cell changes: every one of the other 22 canonical positions
 * delegates straight to the real `primaryDisplayCellFor`, so "other rows remain unchanged" is
 * structural, not approximated.
 *
 * This is a display-only candidate choice, not a formation-cell eligibility change: `LW`/`RW`
 * still validly occupy both y0 and y1 per `validFormationCellsFor` either way.
 */
function attackingMidfieldCellFor(position: "LW" | "RW"): GridCell {
  const cell = validFormationCellsFor(position).find((c) => c.gridY === 1);
  if (!cell) {
    throw new Error(
      `candidate-position-grid: no y1 (attacking-midfield) formation cell found for ${position} — ` +
        "the real ADR-0154 grid table changed shape underneath this candidate override.",
    );
  }
  return cell;
}

export function candidateDisplayCellFor(position: CanonicalTacticalPosition): GridCell {
  if (position === "LW" || position === "RW") return attackingMidfieldCellFor(position);
  return primaryDisplayCellFor(position);
}
