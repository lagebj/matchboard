// ─────────────────────────────────────────────────────────────────
// Canonical tactical-position alias normalization (ADR-0154 §4/§6).
//
// The single authority for collapsing a legacy/verbose input string onto the
// 24-code canonical vocabulary. Canonical exact codes and broad historical
// codes pass through unchanged. Sided exact codes (LCB/RCB/LDM/RDM/LCM/RCM/
// LAM/RAM/LCF/RCF) NEVER collapse onto their unsided sibling — that was the
// dispersion problem this ADR fixes. An unrecognized string is returned
// trimmed/uppercased but otherwise unchanged — this function only
// normalizes; it never fabricates a code it wasn't told about.
// ─────────────────────────────────────────────────────────────────

import { isBroadTacticalPosition, isCanonicalTacticalPosition } from "./roles";

/** Strings that explicitly mean "no declared position", treated as absent. */
export const EMPTY_CANONICAL_DECLARATIONS: ReadonlySet<string> = new Set([
  "",
  "NONE",
  "N/A",
  "-",
  "FLEX",
  "FLEXIBLE",
]);

/**
 * Legacy/verbose alias table (ADR-0154 §6). Keys are already upper-cased.
 * Canonical exact codes and broad codes are handled by
 * `isCanonicalTacticalPosition`/`isBroadTacticalPosition` and are not
 * repeated here.
 */
const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  DM: "CDM",
  AM: "CAM",
  ST: "CF",
  GOALKEEPER: "GK",
  STRIKER: "CF",
  DEFENSIVE_MIDFIELDER: "CDM",
  "DEFENSIVE MIDFIELDER": "CDM",
  ATTACKING_MIDFIELDER: "CAM",
  "ATTACKING MIDFIELDER": "CAM",
  CENTRAL_MIDFIELDER: "CM",
  "CENTRAL MIDFIELDER": "CM",
  CENTRE_MIDFIELDER: "CM",
  "CENTRE MIDFIELDER": "CM",
  CENTER_MIDFIELDER: "CM",
  "CENTER MIDFIELDER": "CM",
  CENTER_BACK: "CB",
  "CENTER BACK": "CB",
  CENTRE_BACK: "CB",
  "CENTRE BACK": "CB",
  // LF/RF are historically used as tactical-position codes (not the
  // football "left/right forward" abbreviation collision risk) — map to
  // their canonical sided-forward equivalent, per ADR-0154 §6.
  LF: "LCF",
  RF: "RCF",
  // Broad, deliberately unsided — stays broad (ADR-0154 §7), never upgraded
  // to a specific wing.
  WINGER: "W",
};

/**
 * Normalizes a persisted/declared position string onto the canonical 24-code
 * (or broad) vocabulary. Returns `null` for empty/placeholder input — never
 * an empty string, so callers can use a straightforward truthiness check.
 *
 * - Trims surrounding whitespace, upper-cases.
 * - Canonical exact codes (24) and broad historical codes (`DEFENDER`/
 *   `MIDFIELDER`/`FORWARD`) pass through unchanged.
 * - Known legacy aliases collapse onto their canonical code.
 * - A sided canonical code (e.g. `LCB`) is NEVER collapsed onto its unsided
 *   sibling (`CB`) — it is already canonical and passes through unchanged.
 * - Anything else (unrecognized) returns the trimmed/upper-cased input
 *   unchanged — this function never invents a code it wasn't told about.
 */
export function normalizeCanonicalPosition(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === "" || EMPTY_CANONICAL_DECLARATIONS.has(trimmed)) return null;

  if (isCanonicalTacticalPosition(trimmed) || isBroadTacticalPosition(trimmed)) {
    return trimmed;
  }

  const alias = LEGACY_ALIASES[trimmed];
  if (alias) return alias;

  return trimmed;
}
