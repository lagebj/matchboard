// ─────────────────────────────────────────────────────────────────
// Automatic-planning compatibility projection (ADR-0154 §5).
//
// Maps each canonical tactical position (plus the three legacy target
// aliases DM/AM/ST, kept for existing callers) onto the directed suitability
// matrix's own base-role/side vocabulary (ADR-0129, `ExactRole`/`Lane`).
// This is compatibility machinery only — it never changes the canonical role
// stored, displayed, evidenced, or returned by planning. The normative
// matrix (`position-suitability-matrix.json`) is never regenerated at 24x24;
// every lookup routes through this projection into the existing 12-role
// matrix unchanged.
// ─────────────────────────────────────────────────────────────────

import type { CanonicalTacticalPosition, ExactRole, Lane } from "./roles";

export type BaseRoleProjection = { baseRole: ExactRole; side: Lane | null };

/** Legacy target aliases accepted alongside the 24 canonical codes (ADR-0129 compatibility). */
export type LegacyTargetAlias = "DM" | "AM" | "ST";

/** Anything `classifyExactSuitability`/`isAutomaticallyEligibleForRole` may receive as a target. */
export type SuitabilityTargetRole = CanonicalTacticalPosition | LegacyTargetAlias;

const PROJECTION: Readonly<Record<SuitabilityTargetRole, BaseRoleProjection>> = {
  GK: { baseRole: "GK", side: null },

  LB: { baseRole: "LB", side: "LEFT" },
  LCB: { baseRole: "CB", side: "LEFT" },
  CB: { baseRole: "CB", side: null },
  RCB: { baseRole: "CB", side: "RIGHT" },
  RB: { baseRole: "RB", side: "RIGHT" },

  LWB: { baseRole: "LB", side: "LEFT" },
  LDM: { baseRole: "DM", side: "LEFT" },
  CDM: { baseRole: "DM", side: null },
  RDM: { baseRole: "DM", side: "RIGHT" },
  RWB: { baseRole: "RB", side: "RIGHT" },

  LM: { baseRole: "LM", side: "LEFT" },
  LCM: { baseRole: "CM", side: "LEFT" },
  CM: { baseRole: "CM", side: null },
  RCM: { baseRole: "CM", side: "RIGHT" },
  RM: { baseRole: "RM", side: "RIGHT" },

  LW: { baseRole: "LW", side: "LEFT" },
  LAM: { baseRole: "AM", side: "LEFT" },
  CAM: { baseRole: "AM", side: null },
  RAM: { baseRole: "AM", side: "RIGHT" },
  RW: { baseRole: "RW", side: "RIGHT" },

  LCF: { baseRole: "ST", side: "LEFT" },
  CF: { baseRole: "ST", side: null },
  RCF: { baseRole: "ST", side: "RIGHT" },

  // Legacy target aliases — same base role/side as their canonical replacement.
  DM: { baseRole: "DM", side: null },
  AM: { baseRole: "AM", side: null },
  ST: { baseRole: "ST", side: null },
};

/**
 * Projects any accepted target role onto `{baseRole, side}` for suitability
 * scoring. Returns `null` only for a value outside `SuitabilityTargetRole`
 * (never happens for correctly-typed input; defensive for raw/untyped
 * callers at a system boundary).
 */
export function projectToBaseRole(target: string): BaseRoleProjection | null {
  return PROJECTION[target as SuitabilityTargetRole] ?? null;
}
