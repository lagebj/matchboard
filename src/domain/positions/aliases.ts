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

export type NormalizedSource =
  | { known: true; role: SourceRole; sourceSide: Lane | null }
  | { known: false; role: "UNKNOWN"; sourceSide: null };

const UNKNOWN: NormalizedSource = { known: false, role: "UNKNOWN", sourceSide: null };

/**
 * Exact alias table (§2). Keys are already upper-cased. Canonical exact roles
 * are handled by {@link isExactRole} and are not repeated here.
 */
const ALIAS_TABLE: Record<string, { role: SourceRole; sourceSide: Lane | null }> = {
  CDM: { role: "DM", sourceSide: null },
  CAM: { role: "AM", sourceSide: null },
  CF: { role: "ST", sourceSide: null },
  LCB: { role: "CB", sourceSide: "LEFT" },
  RCB: { role: "CB", sourceSide: "RIGHT" },
  SS: { role: "SS", sourceSide: null },
  W: { role: "W", sourceSide: null },
};

/** Strings that explicitly mean "no declared position", treated as absent. */
const EMPTY_DECLARATIONS: ReadonlySet<string> = new Set(["", "NONE", "N/A", "-", "FLEX", "FLEXIBLE"]);

export function normalizeSourceRole(raw: string | null | undefined): NormalizedSource {
  if (raw == null) return UNKNOWN;
  const key = raw.trim().toUpperCase();
  if (EMPTY_DECLARATIONS.has(key)) return UNKNOWN;

  if (isExactRole(key)) {
    return { known: true, role: key, sourceSide: null };
  }

  const alias = ALIAS_TABLE[key];
  if (alias) {
    return { known: true, role: alias.role, sourceSide: alias.sourceSide };
  }

  return UNKNOWN;
}

/** True when the raw string carries no usable declared position at all. */
export function isEmptyDeclaration(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  return EMPTY_DECLARATIONS.has(raw.trim().toUpperCase());
}
