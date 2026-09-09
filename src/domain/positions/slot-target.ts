// ─────────────────────────────────────────────────────────────────
// Formation slot → exact target role (ADR-0129 §4).
//
// Derivation uses roleType + canonical lane from gridX ONLY. Free-form
// `label` / `shortLabel` strings are never parsed. `FormationSlot.acceptedPositionIds`
// is not consulted — it is no longer exact automatic-eligibility authority.
//
// FREE slots derive NO automatic target role: they are manual-only for
// automatic assignment. Never infer a FREE slot's role from neighbours
// or labels.
// ─────────────────────────────────────────────────────────────────

import { laneFromGridX } from "@/lib/formations/types";
import type { FormationSlotRoleType } from "@/lib/formations/types";
import type { ExactRole } from "./roles";

/**
 * The exact target role a formation slot requires, or `null` when it derives
 * none (a `FREE` slot, or an unrecognised role type). `laneFromGridX`
 * (src/lib/formations/types.ts) is the single owner of lane-from-gridX;
 * do not re-derive it here.
 *
 * | roleType              | LEFT | CENTRE | RIGHT |
 * |-----------------------|------|--------|-------|
 * | GOALKEEPER            | GK   | GK     | GK    |
 * | DEFENDER              | LB   | CB     | RB    |
 * | DEFENSIVE_MIDFIELDER  | DM   | DM     | DM    |
 * | MIDFIELDER            | LM   | CM     | RM    |
 * | ATTACKING_MIDFIELDER  | LW   | AM     | RW    |
 * | FORWARD               | LW   | ST     | RW    |
 * | FREE                  | null | null   | null  |
 */
export function deriveExactTargetRole(
  roleType: FormationSlotRoleType,
  gridX: number,
): ExactRole | null {
  const lane = laneFromGridX(gridX);
  switch (roleType) {
    case "GOALKEEPER":
      return "GK";
    case "DEFENDER":
      return lane === "LEFT" ? "LB" : lane === "RIGHT" ? "RB" : "CB";
    case "DEFENSIVE_MIDFIELDER":
      return "DM";
    case "MIDFIELDER":
      return lane === "LEFT" ? "LM" : lane === "RIGHT" ? "RM" : "CM";
    case "ATTACKING_MIDFIELDER":
      return lane === "LEFT" ? "LW" : lane === "RIGHT" ? "RW" : "AM";
    case "FORWARD":
      return lane === "LEFT" ? "LW" : lane === "RIGHT" ? "RW" : "ST";
    case "FREE":
      return null;
    default:
      return null;
  }
}

/** True when this slot has a derivable exact target role for automatic planning. */
export function slotHasExactAutomaticTarget(roleType: FormationSlotRoleType, gridX: number): boolean {
  return deriveExactTargetRole(roleType, gridX) !== null;
}
