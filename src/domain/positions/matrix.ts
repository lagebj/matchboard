// ─────────────────────────────────────────────────────────────────
// Directed source→target suitability matrix and tier classification
// (ADR-0129 §4/§5/§7).
//
// `position-suitability-matrix.json` is the product-owner-supplied
// NORMATIVE artifact (a verbatim copy of the programme bundle's
// data/position-suitability-matrix.json). It is never re-tuned,
// re-typed by hand, or symmetrized here. Scores are directed and
// asymmetric: directedMatrixScore("ST","LW") need not equal
// directedMatrixScore("LW","ST").
// ─────────────────────────────────────────────────────────────────

import matrixJson from "./position-suitability-matrix.json";
import type { ExactRole, SourceRole } from "./roles";

type MatrixShape = {
  version: number;
  status: string;
  targets: ExactRole[];
  declarationMultipliers: { primary: number; secondary: number; tertiary: number };
  bestSideModifier: { same: number; opposite: number; center: number };
  tiers: { name: SuitabilityTier; min: number; max?: number; maxExclusive?: number }[];
  matrix: Record<SourceRole, Record<ExactRole, number>>;
};

const DATA = matrixJson as unknown as MatrixShape;

export type SuitabilityTier =
  | "NATURAL"
  | "STRONG"
  | "PLAUSIBLE"
  | "DEVELOPMENTAL"
  | "UNSUPPORTED";

/** Tiers whose players are automatically eligible for a required exact role (§7). */
export const AUTOMATIC_ELIGIBLE_TIERS: readonly SuitabilityTier[] = [
  "NATURAL",
  "STRONG",
  "PLAUSIBLE",
];

export function isAutomaticTier(tier: SuitabilityTier): boolean {
  return AUTOMATIC_ELIGIBLE_TIERS.includes(tier);
}

/** Declaration weighting (§5): primary 1.00, secondary 0.95, tertiary 0.90. */
export const DECLARATION_MULTIPLIERS: Readonly<Record<"primary" | "secondary" | "tertiary", number>> = {
  primary: DATA.declarationMultipliers.primary,
  secondary: DATA.declarationMultipliers.secondary,
  tertiary: DATA.declarationMultipliers.tertiary,
};

/** Best-side modifier magnitudes (§6): matching side +4, opposite −4, centre 0. */
export const BEST_SIDE_MODIFIER: Readonly<{ same: number; opposite: number; center: number }> = {
  same: DATA.bestSideModifier.same,
  opposite: DATA.bestSideModifier.opposite,
  center: DATA.bestSideModifier.center,
};

export function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Directed suitability of a normalized source role for an exact target role,
 * before declaration weighting and the best-side modifier. Always `0..100`.
 * A source role absent from the matrix (should not happen for a known
 * {@link SourceRole}) scores 0.
 */
export function directedMatrixScore(source: SourceRole, target: ExactRole): number {
  const row = DATA.matrix[source];
  if (!row) return 0;
  const score = row[target];
  return typeof score === "number" ? score : 0;
}

/**
 * Tier for a final (post-weighting, post-modifier, clamped) score.
 * NATURAL 90–100 · STRONG 70–<90 · PLAUSIBLE 50–<70 · DEVELOPMENTAL 30–<50 ·
 * UNSUPPORTED 0–<30.
 */
export function tierForScore(score: number): SuitabilityTier {
  const s = clampScore(score);
  if (s >= 90) return "NATURAL";
  if (s >= 70) return "STRONG";
  if (s >= 50) return "PLAUSIBLE";
  if (s >= 30) return "DEVELOPMENTAL";
  return "UNSUPPORTED";
}

export const MATRIX_VERSION = DATA.version;
export const MATRIX_TARGETS: readonly ExactRole[] = DATA.targets;
