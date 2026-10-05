// ─────────────────────────────────────────────────────────────────
// Canonical tactical-position labels (ADR-0154 §1/§18).
//
// The single full-label and compact-label authority for the 24-code
// vocabulary, sourced from canonical position metadata rather than a
// second hand-written dictionary. Compact label = canonical code, by
// design (ADR-0154 §18).
// ─────────────────────────────────────────────────────────────────

import { normalizeCanonicalPosition } from "./canonical-aliases";
import { isBroadTacticalPosition, isCanonicalTacticalPosition, type CanonicalTacticalPosition } from "./roles";

export const CANONICAL_FULL_LABELS: Readonly<Record<CanonicalTacticalPosition, string>> = {
  GK: "Goalkeeper",

  CB: "Centre Back",
  LCB: "Left Centre Back",
  RCB: "Right Centre Back",
  LB: "Left Back",
  RB: "Right Back",

  CDM: "Centre Defensive Midfield",
  LDM: "Left Defensive Midfield",
  RDM: "Right Defensive Midfield",
  LWB: "Left Wing Back",
  RWB: "Right Wing Back",

  CM: "Central Midfield",
  LCM: "Left Central Midfield",
  RCM: "Right Central Midfield",
  LM: "Left Midfield",
  RM: "Right Midfield",

  CAM: "Central Attacking Midfield",
  LAM: "Left Attacking Midfield",
  RAM: "Right Attacking Midfield",

  LW: "Left Wing",
  RW: "Right Wing",

  CF: "Central Forward",
  LCF: "Left Central Forward",
  RCF: "Right Central Forward",
};

/** Broad historical positions keep a broad, human label — never upgraded to exact. */
export const BROAD_POSITION_FULL_LABELS: Readonly<Record<string, string>> = {
  DEFENDER: "Defender",
  MIDFIELDER: "Midfielder",
  FORWARD: "Forward",
  W: "Winger",
  WM: "Wide Midfielder",
  FLEXIBLE: "Flexible",
};

/** Compact label: exact canonical codes render as themselves; broad codes render title-cased. */
export const COMPACT_BROAD_POSITION_LABELS: Readonly<Record<string, string>> = {
  DEFENDER: "Defender",
  MIDFIELDER: "Midfielder",
  FORWARD: "Forward",
  W: "Winger",
  WM: "WM",
  FLEXIBLE: "Flexible",
};

/**
 * Humanizes an unrecognized code so it never renders as raw SCREAMING_SNAKE_CASE:
 * replaces underscores/spaces with single spaces and title-cases each word.
 * Invents no tactical meaning — purely cosmetic formatting of the code that's
 * already there.
 */
function humanizeUnknownCode(code: string): string {
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Full human-readable label for a canonical/broad/legacy position code,
 * normalizing legacy aliases first. Falls back to a humanized rendering of
 * the (normalized) code for anything not in the table — never blank, never
 * raw SCREAMING_SNAKE_CASE.
 */
export function canonicalFullLabel(code: string): string {
  const normalized = normalizeCanonicalPosition(code) ?? code;
  if (isCanonicalTacticalPosition(normalized)) return CANONICAL_FULL_LABELS[normalized];
  if (isBroadTacticalPosition(normalized)) return BROAD_POSITION_FULL_LABELS[normalized] ?? humanizeUnknownCode(normalized);
  return humanizeUnknownCode(normalized);
}

/**
 * Compact label for dense table/roster cells: canonical codes stay as
 * themselves (`LCB`, `CDM`), broad codes stay broad but human, unknown codes
 * fall back to the same humanized rendering `canonicalFullLabel` uses.
 */
export function canonicalCompactLabel(code: string): string {
  const normalized = normalizeCanonicalPosition(code) ?? code;
  if (isCanonicalTacticalPosition(normalized)) return normalized;
  if (isBroadTacticalPosition(normalized)) return COMPACT_BROAD_POSITION_LABELS[normalized] ?? humanizeUnknownCode(normalized);
  return humanizeUnknownCode(normalized);
}
