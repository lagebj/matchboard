/**
 * The one position-code normalization authority (Matchboard Players Operating Surface bundle,
 * `03_POSITION_MODEL_AND_LABEL_CONTRACT.md §2`). Domain normalization only — no presentation
 * labels here (see `src/lib/touchline/presentation/exact-position-labels.ts` for those).
 *
 * Canonical exact codes (`GK`/`CB`/`LB`/`RB`/`CM`/`DM`/`AM`/`LM`/`RM`/`WM`/`LW`/`RW`/`W`/`ST`/`CF`)
 * pass through unchanged. Known legacy/verbose aliases (e.g. `DEFENSIVE_MIDFIELDER`,
 * `GOALKEEPER`) collapse onto the exact code they mean. Broad historical positions
 * (`DEFENDER`/`MIDFIELDER`/`FORWARD`) intentionally stay broad — they must never be silently
 * upgraded to a specific exact code, since that would fabricate positional precision no evidence
 * actually supports.
 *
 * Every evidence input that ends up in the effective-position engine (declared primary/
 * secondary/tertiary, `ActualPositionInterval.position`, POSITION observation `positionId`) must
 * be normalized with this function before aggregation, so `DEFENSIVE_MIDFIELDER` and `DM` never
 * become two separate effective positions for the same player.
 */

const CANONICAL_EXACT_CODES = new Set([
  "GK",
  "CB",
  "LB",
  "RB",
  "CM",
  "DM",
  "AM",
  "LM",
  "RM",
  "WM",
  "LW",
  "RW",
  "W",
  "ST",
  "CF",
]);

const BROAD_CODES = new Set(["DEFENDER", "MIDFIELDER", "FORWARD"]);

const LEGACY_ALIASES: Record<string, string> = {
  GOALKEEPER: "GK",
  DEFENSIVE_MIDFIELDER: "DM",
  "DEFENSIVE MIDFIELDER": "DM",
  ATTACKING_MIDFIELDER: "AM",
  "ATTACKING MIDFIELDER": "AM",
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
  WINGER: "W",
  STRIKER: "ST",
};

/**
 * Normalizes a persisted/declared position code into the shared canonical vocabulary. Returns
 * `null` for empty/blank input — never an empty string, so callers can use a straightforward
 * truthiness check.
 *
 * - Trims surrounding whitespace.
 * - Canonical exact codes and broad historical codes pass through unchanged (case-sensitive —
 *   the persisted vocabulary is already uppercase).
 * - Known legacy aliases collapse onto their exact code, matched case-insensitively so both
 *   underscore and space-separated legacy forms normalize identically.
 * - Anything else (an unrecognized value) is returned unchanged — this function only
 *   normalizes; it never invents a code it wasn't told about. Presentation-layer humanization of
 *   unknown codes is `exactPositionLabel()`'s job, not this one's.
 */
export function normalizePlayerPositionCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  if (trimmed === "") return null;

  if (CANONICAL_EXACT_CODES.has(trimmed) || BROAD_CODES.has(trimmed)) {
    return trimmed;
  }

  const aliasKey = trimmed.toUpperCase();
  const alias = LEGACY_ALIASES[aliasKey];
  if (alias) return alias;

  return trimmed;
}
