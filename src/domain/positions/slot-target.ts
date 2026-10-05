// ─────────────────────────────────────────────────────────────────
// Formation slot → target role (ADR-0129 §4, replaced by ADR-0154 §8).
//
// Derivation uses the normative grid cell (gridX, gridY) via
// `canonicalPositionForCell` — never roleType + a 3-lane gridX compression.
// Free-form `label` / `shortLabel` strings are never parsed.
// `FormationSlot.acceptedPositionIds` is not consulted — it is not exact
// automatic-eligibility authority.
//
// `roleType` is validated for consistency against the cell's derived
// position (a defence-row cell with a MIDFIELDER roleType is a data
// contradiction, not something to silently resolve) rather than being used
// to independently invent a position. FREE slots derive NO automatic
// target role: they are manual-only for automatic assignment.
// ─────────────────────────────────────────────────────────────────

import type { FormationSlotRoleType } from "@/lib/formations/types";
import { canonicalPositionForCell } from "./grid";
import type { CanonicalTacticalPosition } from "./roles";

/** The broad depth/category each `FormationSlotRoleType` is expected to land in. */
const ROLE_TYPE_DEPTH: Readonly<Record<FormationSlotRoleType, "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD" | null>> = {
  GOALKEEPER: "GK",
  DEFENDER: "DEF",
  DEFENSIVE_MIDFIELDER: "DM",
  MIDFIELDER: "MID",
  ATTACKING_MIDFIELDER: "AM",
  FORWARD: "FWD",
  FREE: null,
};

/**
 * Which depth category/categories a grid cell's derived canonical position is valid for.
 * `LW`/`RW` are valid for both `FWD` and `AM` — their two-cell identity (ADR-0154 §3) means
 * the same canonical position legitimately appears on either depth row.
 */
const POSITION_DEPTH: Readonly<Record<CanonicalTacticalPosition, readonly ("GK" | "DEF" | "DM" | "MID" | "AM" | "FWD")[]>> = {
  GK: ["GK"],
  LB: ["DEF"],
  LCB: ["DEF"],
  CB: ["DEF"],
  RCB: ["DEF"],
  RB: ["DEF"],
  LWB: ["DM"],
  LDM: ["DM"],
  CDM: ["DM"],
  RDM: ["DM"],
  RWB: ["DM"],
  LM: ["MID"],
  LCM: ["MID"],
  CM: ["MID"],
  RCM: ["MID"],
  RM: ["MID"],
  LW: ["FWD", "AM"],
  LAM: ["AM"],
  CAM: ["AM"],
  RAM: ["AM"],
  RW: ["FWD", "AM"],
  LCF: ["FWD"],
  CF: ["FWD"],
  RCF: ["FWD"],
};

/**
 * The target role a formation slot requires, derived from its grid cell —
 * or `null` when it derives none (a `FREE` slot, an unrecognised role type,
 * a non-position `y5` cell, or a `roleType`/cell depth contradiction — see
 * below). `LW`/`RW` are returned for both their valid cells (`y0`/`y1`).
 */
export function deriveExactTargetRole(
  roleType: FormationSlotRoleType,
  gridX: number,
  gridY: number,
): CanonicalTacticalPosition | null {
  if (roleType === "FREE") return null;

  const position = canonicalPositionForCell(gridX, gridY);
  if (!position) return null;

  const expectedDepth = ROLE_TYPE_DEPTH[roleType];
  if (expectedDepth === null) return null;
  // GOALKEEPER/roleType must land on the GK cell; every outfield roleType must
  // land on its own depth category. A contradiction (e.g. a MIDFIELDER
  // roleType slot placed on the defence row) derives no target — never
  // silently resolved by trusting one input over the other.
  if (!POSITION_DEPTH[position].includes(expectedDepth)) return null;

  return position;
}

/** True when this slot has a derivable target role for automatic planning. */
export function slotHasExactAutomaticTarget(roleType: FormationSlotRoleType, gridX: number, gridY: number): boolean {
  return deriveExactTargetRole(roleType, gridX, gridY) !== null;
}
