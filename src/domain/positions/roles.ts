// ─────────────────────────────────────────────────────────────────
// Exact football-role vocabulary for automatic planning (ADR-0129).
//
// These twelve codes are the ONLY exact automatic target roles in the
// Productification programme. Broad `BroadPosition` / `StructuralRole` /
// `OutfieldStructuralRole` families (see src/domain/team-composition/,
// src/lib/formations/) remain valid for genuinely broad questions
// (reporting buckets, team-composition's cross-team distribution,
// squad composition without exact formation context) — but they are
// NOT exact automatic-eligibility authority. This module is.
// ─────────────────────────────────────────────────────────────────

/** The twelve exact target roles automatic planning may fill. */
export const EXACT_ROLES = [
  "GK",
  "LB",
  "CB",
  "RB",
  "DM",
  "CM",
  "AM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
] as const;

export type ExactRole = (typeof EXACT_ROLES)[number];

/**
 * A normalized declared *source* role. The twelve exact roles plus the two
 * special source profiles the normative matrix carries rows for:
 * - `SS` — second striker / withdrawn forward source profile.
 * - `W` — unsided winger source profile (declared simply as "W").
 */
export type SourceRole = ExactRole | "SS" | "W";

export const SOURCE_ROLES: readonly SourceRole[] = [...EXACT_ROLES, "SS", "W"];

/** Canonical horizontal lane. Matches `laneFromGridX` in src/lib/formations/types.ts. */
export type Lane = "LEFT" | "CENTRE" | "RIGHT";

/**
 * `Player.bestSide` values, normalized to the `Lane` spelling used here
 * (`BestSide.CENTER` → `"CENTRE"`).
 */
export type SideInput = "LEFT" | "CENTER" | "CENTRE" | "RIGHT" | null | undefined;

export function isExactRole(value: string): value is ExactRole {
  return (EXACT_ROLES as readonly string[]).includes(value);
}

export function isSourceRole(value: string): value is SourceRole {
  return (SOURCE_ROLES as readonly string[]).includes(value);
}

/**
 * Which side of the pitch an exact target role sits on. Only `LEFT` / `RIGHT`
 * targets receive a best-side modifier (§6); everything else is `CENTRE` (no
 * modifier).
 */
export const TARGET_ROLE_SIDE: Record<ExactRole, Lane> = {
  GK: "CENTRE",
  LB: "LEFT",
  CB: "CENTRE",
  RB: "RIGHT",
  DM: "CENTRE",
  CM: "CENTRE",
  AM: "CENTRE",
  LM: "LEFT",
  RM: "RIGHT",
  LW: "LEFT",
  RW: "RIGHT",
  ST: "CENTRE",
};

/**
 * Source roles that carry no intrinsic side, so the best-side modifier (§6)
 * may apply to them for a left/right target. Verbatim from the normative
 * matrix's `bestSideModifier.applyOnlyWhenSourceIsUnsided`. Explicitly sided
 * source roles (`LB/LM/LW/RB/RM/RW`) never receive the modifier.
 */
export const UNSIDED_SOURCE_ROLES: ReadonlySet<SourceRole> = new Set<SourceRole>([
  "CB",
  "DM",
  "CM",
  "AM",
  "ST",
  "SS",
  "W",
]);

export function normalizeSideInput(value: SideInput): Lane | null {
  switch (value) {
    case "LEFT":
      return "LEFT";
    case "RIGHT":
      return "RIGHT";
    case "CENTER":
    case "CENTRE":
      return "CENTRE";
    default:
      return null;
  }
}
