// ─────────────────────────────────────────────────────────────────
// Declared-position string → normalized source role (ADR-0129 §2/§3).
//
// Normalization is EXACT. Trimming and upper-casing are applied first
// (so "gk" and " GK " both resolve to GK), then an exact table lookup.
// There is no substring / fuzzy fallback — an unrecognised string
// resolves to UNKNOWN and produces NO automatic exact-role eligibility
// for any target. Unknown strings are never destructively rewritten in
// storage (that stays a coach action).
// ─────────────────────────────────────────────────────────────────

import type { Lane, SourceRole } from "./roles";
import { isExactRole } from "./roles";
import { normalizeCanonicalPosition } from "./canonical-aliases";
import { projectToBaseRole } from "./compatibility-projection";

export type NormalizedSource =
  | { known: true; role: SourceRole; sourceSide: Lane | null }
  | { known: false; role: "UNKNOWN"; sourceSide: null };

const UNKNOWN: NormalizedSource = { known: false, role: "UNKNOWN", sourceSide: null };

/**
 * Special unsided source profiles the suitability matrix carries rows for,
 * outside the canonical 24-code vocabulary (§2/ADR-0154). Not repeated in
 * the canonical-alias table — these are matrix-scoring concepts only, never
 * a declared/displayed tactical identity.
 */
const SPECIAL_SOURCE_ROLES: ReadonlySet<string> = new Set(["SS", "W"]);

/** Strings that explicitly mean "no declared position", treated as absent. */
const EMPTY_DECLARATIONS: ReadonlySet<string> = new Set(["", "NONE", "N/A", "-", "FLEX", "FLEXIBLE"]);

/**
 * Normalizes a raw declared/recorded position string into a suitability-
 * matrix row (`SourceRole`) + optional source side, for scoring purposes
 * only (ADR-0129 §2/§3, extended by ADR-0154 §4/§5).
 *
 * Pipeline: canonicalize the raw string onto the 24-code vocabulary (or a
 * broad/unrecognized passthrough, via {@link normalizeCanonicalPosition} —
 * the single canonical-identity authority, ADR-0154), then project the
 * canonical result onto the matrix's base-role/side vocabulary (via
 * {@link projectToBaseRole}). A sided canonical code (e.g. `LCB`) still
 * projects to its base-role row (`CB`) + side (`LEFT`) for scoring — this is
 * matrix-lookup machinery only and does not change what gets stored,
 * displayed, or evidenced as the player's canonical position elsewhere.
 *
 * Unknown strings are never substring-fuzzy-matched and produce `UNKNOWN`
 * (no automatic exact-role eligibility for any target) — unchanged from
 * ADR-0129.
 */
export function normalizeSourceRole(raw: string | null | undefined): NormalizedSource {
  if (raw == null) return UNKNOWN;
  const key = raw.trim().toUpperCase();
  if (EMPTY_DECLARATIONS.has(key)) return UNKNOWN;

  if (SPECIAL_SOURCE_ROLES.has(key)) {
    return { known: true, role: key as SourceRole, sourceSide: null };
  }

  // Canonical exact roles already in the old 12-code vocabulary pass straight
  // through without a projection round-trip (micro-optimization; behaviorally
  // identical to projecting them, since each is its own base role with the
  // matrix's own fixed side).
  if (isExactRole(key)) {
    return { known: true, role: key, sourceSide: null };
  }

  const canonical = normalizeCanonicalPosition(key);
  if (canonical) {
    const projection = projectToBaseRole(canonical);
    if (projection) {
      return { known: true, role: projection.baseRole, sourceSide: projection.side };
    }
  }

  return UNKNOWN;
}

/** True when the raw string carries no usable declared position at all. */
export function isEmptyDeclaration(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  return EMPTY_DECLARATIONS.has(raw.trim().toUpperCase());
}
