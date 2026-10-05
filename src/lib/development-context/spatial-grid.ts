/**
 * The 5x6 spatial zone lookup (ADR-0155 §3, source bundle §03's "5 x 6 grid"). Pure coordinate
 * math only — this module never reads an event payload or decides whether a coordinate is
 * "known"; that normalization (and the attacking-direction-flip decision, which must never be
 * guessed) is a B2 concern, since no event carries a coordinate today (ADR-0155's disclosed
 * limitation).
 *
 * Convention: `x` in [0,1] is depth, own goal -> opponent goal (6 bands, D1..D6). `y` in [0,1] is
 * lane, team-left -> team-right (5 bands, L1..L5). Zone id is `D{1..6}_L{1..5}`.
 *
 * Boundary rule: bands are half-open on the lower side ([k/N, (k+1)/N)), so an exact internal
 * boundary always belongs to the higher band — this falls out of `Math.floor` directly, except
 * at the coordinate's own upper bound (1), which is special-cased to the last band (the final
 * band is closed on both ends: `[(N-1)/N, 1]`).
 */

const DEPTH_BANDS = 6;
const LANE_BANDS = 5;

function isValidUnitCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function bandIndex(value: number, bandCount: number): number {
  if (value === 1) return bandCount - 1;
  return Math.floor(value * bandCount);
}

/**
 * Looks up the `D#_L#` zone for a normalized `(x, y)` coordinate pair. Returns `null` for any
 * invalid input (`null`/`undefined`/`NaN`/out-of-range) — invalid source coordinates are never
 * clamped onto the pitch.
 */
export function zoneForCoordinate(x: number | null | undefined, y: number | null | undefined): string | null {
  if (!isValidUnitCoordinate(x) || !isValidUnitCoordinate(y)) return null;
  const depthIndex = bandIndex(x, DEPTH_BANDS);
  const laneIndex = bandIndex(y, LANE_BANDS);
  return `D${depthIndex + 1}_L${laneIndex + 1}`;
}
