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

// ─────────────────────────────────────────────────────────────────
// Canonical 24-code tactical-position vocabulary (ADR-0154).
//
// Extends, does not replace, the 12-code `ExactRole` above — ExactRole
// remains the automatic-planning suitability matrix's own base-role/column
// vocabulary (ADR-0129) and is projected onto from here (see
// compatibility-projection.ts). `CanonicalTacticalPosition` is the single
// tactical-identity vocabulary for declaration, formation geometry, actual-
// position evidence, reporting, and AI context (ADR-0154 §1).
// ─────────────────────────────────────────────────────────────────

export const CANONICAL_TACTICAL_POSITIONS = [
  "GK",
  "LB",
  "LCB",
  "CB",
  "RCB",
  "RB",
  "LWB",
  "LDM",
  "CDM",
  "RDM",
  "RWB",
  "LM",
  "LCM",
  "CM",
  "RCM",
  "RM",
  "LW",
  "LAM",
  "CAM",
  "RAM",
  "RW",
  "LCF",
  "CF",
  "RCF",
] as const;

export type CanonicalTacticalPosition = (typeof CANONICAL_TACTICAL_POSITIONS)[number];

const CANONICAL_TACTICAL_POSITION_SET: ReadonlySet<string> = new Set(CANONICAL_TACTICAL_POSITIONS);

export function isCanonicalTacticalPosition(value: string): value is CanonicalTacticalPosition {
  return CANONICAL_TACTICAL_POSITION_SET.has(value);
}

/**
 * Historical/broad composition concepts (ADR-0154 §7): `DEFENDER`/`MIDFIELDER`/
 * `FORWARD` plus the unsided-wing/flexible legacy concepts `W`/`WM`/`FLEXIBLE`.
 * Never canonical tactical positions — must not be fabricated into exact
 * precision they don't carry, and must not appear in a coach-facing exact-
 * position selector. (`W` remains a separate special *source* role for
 * suitability-matrix scoring, see `SOURCE_ROLES` above — that is a distinct,
 * unaffected concern from this broad/canonical-identity classification.)
 */
export const BROAD_TACTICAL_POSITIONS = ["DEFENDER", "MIDFIELDER", "FORWARD", "W", "WM", "FLEXIBLE"] as const;

export type BroadTacticalPosition = (typeof BROAD_TACTICAL_POSITIONS)[number];

const BROAD_TACTICAL_POSITION_SET: ReadonlySet<string> = new Set(BROAD_TACTICAL_POSITIONS);

export function isBroadTacticalPosition(value: string): value is BroadTacticalPosition {
  return BROAD_TACTICAL_POSITION_SET.has(value);
}

/**
 * The five lines whose centre code (`CB`/`CDM`/`CM`/`CAM`/`CF`) is an unsided
 * declaration spanning left/centre/right (ADR-0154 follow-up: evidence/suitability
 * spread across `L{code}`/`{code}`/`R{code}`). Wide, inherently-sided codes
 * (`LB`/`RB`, `LM`/`RM`, `LW`/`RW`) are deliberately excluded — they have no
 * unsided sibling and must never spread to their opposite side.
 */
export const UNSIDED_CENTRE_LINE_POSITIONS = ["CB", "CDM", "CM", "CAM", "CF"] as const;

export type UnsidedCentreLinePosition = (typeof UNSIDED_CENTRE_LINE_POSITIONS)[number];

/**
 * The left/centre/right triple for each unsided centre-line position, e.g.
 * `CM` → `["LCM", "CM", "RCM"]`. Used by evidence-blending (ADR-0139 effective-
 * position profile) to spread a declared unsided centre-line position's support
 * across all three cells of its line — never applied to wide sided positions.
 */
export const CENTRE_LINE_TRIPLES: Readonly<Record<UnsidedCentreLinePosition, readonly CanonicalTacticalPosition[]>> = {
  CB: ["LCB", "CB", "RCB"],
  CDM: ["LDM", "CDM", "RDM"],
  CM: ["LCM", "CM", "RCM"],
  CAM: ["LAM", "CAM", "RAM"],
  CF: ["LCF", "CF", "RCF"],
};

export function isUnsidedCentreLinePosition(value: string): value is UnsidedCentreLinePosition {
  return (UNSIDED_CENTRE_LINE_POSITIONS as readonly string[]).includes(value);
}
