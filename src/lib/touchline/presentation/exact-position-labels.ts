import { normalizePlayerPositionCode } from "@/lib/player-development/position-code";

/**
 * The one human-readable position label authority (Matchboard Players Operating Surface bundle,
 * `03_POSITION_MODEL_AND_LABEL_CONTRACT.md §3`). Normalizes through the shared
 * `normalizePlayerPositionCode()` domain authority before resolving a label, so legacy/verbose
 * persisted values (e.g. `DEFENSIVE_MIDFIELDER`, `GOALKEEPER`) resolve to the same label their
 * normalized exact code would, and never render as a raw SCREAMING_SNAKE_CASE identifier.
 *
 * Covers every exact tactical code `src/components/touchline/pitch/position-coordinates.ts`'s
 * `POSITION_GRID` can place on the canonical position map, plus the broad historical codes
 * (`DEFENDER`/`MIDFIELDER`/`FORWARD`) that must stay broad rather than being upgraded to a
 * specific tactical label.
 */
export const EXACT_POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeeper",
  CB: "Centre Back",
  LB: "Left Back",
  RB: "Right Back",
  CM: "Centre Midfield",
  DM: "Defensive Midfield",
  AM: "Attacking Midfield",
  LM: "Left Midfield",
  RM: "Right Midfield",
  WM: "Wide Midfield",
  LW: "Left Wing",
  RW: "Right Wing",
  W: "Wing",
  ST: "Striker",
  CF: "Centre Forward",
};

/** Broad historical positions: full label stays broad, never a specific tactical label. */
export const BROAD_POSITION_LABELS: Record<string, string> = {
  DEFENDER: "Defender",
  MIDFIELDER: "Midfielder",
  FORWARD: "Forward",
};

/** Compact labels for dense table cells — exact codes render as themselves; broad codes render title-cased. */
export const COMPACT_POSITION_LABELS: Record<string, string> = {
  GK: "GK",
  CB: "CB",
  LB: "LB",
  RB: "RB",
  CM: "CM",
  DM: "DM",
  AM: "AM",
  LM: "LM",
  RM: "RM",
  WM: "WM",
  LW: "LW",
  RW: "RW",
  W: "W",
  ST: "ST",
  CF: "CF",
  DEFENDER: "Defender",
  MIDFIELDER: "Midfielder",
  FORWARD: "Forward",
};

/**
 * Humanizes an unrecognized position code so it never renders as raw SCREAMING_SNAKE_CASE:
 * replaces underscores with spaces and title-cases each word. Invents no tactical meaning —
 * purely cosmetic text formatting of the code that's already there.
 */
function humanizeUnknownCode(code: string): string {
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Full human-readable label for an exact/broad position code, normalizing legacy aliases first.
 * Falls back to a humanized rendering of the (normalized) code for anything not in the table —
 * never a blank, never a raw SCREAMING_SNAKE_CASE string.
 */
export function exactPositionLabel(code: string): string {
  const normalized = normalizePlayerPositionCode(code) ?? code;
  return EXACT_POSITION_LABELS[normalized] ?? BROAD_POSITION_LABELS[normalized] ?? humanizeUnknownCode(normalized);
}

/**
 * Compact label for dense table/roster cells: exact codes stay short (`DM`, `ST`), broad codes
 * stay broad but human (`Defender`), unknown codes fall back to the same humanized rendering
 * `exactPositionLabel()` uses. Never returns a raw persisted identifier.
 */
export function compactPositionLabel(code: string): string {
  const normalized = normalizePlayerPositionCode(code) ?? code;
  return COMPACT_POSITION_LABELS[normalized] ?? humanizeUnknownCode(normalized);
}
