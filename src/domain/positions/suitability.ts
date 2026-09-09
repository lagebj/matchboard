// ─────────────────────────────────────────────────────────────────
// Player → exact target-role suitability (ADR-0129 §5/§6/§7).
//
// For each declared source role, independently:
//   1. normalize the source string;
//   2. read the directed matrix score;
//   3. multiply by the declaration multiplier (primary 1.00 / secondary
//      0.95 / tertiary 0.90);
//   4. apply the best-side modifier IF the source role is unsided and the
//      target is a left/right role;
//   5. clamp to 0–100.
// Effective suitability for the target is the MAXIMUM across declarations.
//
// This module has no parameter for fairness, evidence, opponent context,
// tactical attributes or strength — by construction, none of those can
// create or upgrade positional eligibility (§5).
// ─────────────────────────────────────────────────────────────────

import type { ExactRole, Lane, SideInput } from "./roles";
import { TARGET_ROLE_SIDE, UNSIDED_SOURCE_ROLES, normalizeSideInput } from "./roles";
import { normalizeSourceRole, type NormalizedSource } from "./aliases";
import {
  BEST_SIDE_MODIFIER,
  DECLARATION_MULTIPLIERS,
  clampScore,
  directedMatrixScore,
  isAutomaticTier,
  tierForScore,
  type SuitabilityTier,
} from "./matrix";

export type DeclarationSlot = "primary" | "secondary" | "tertiary";

/** The declared-position facts this model reads. Nothing else. */
export interface DeclaredPositions {
  primaryPosition: string | null | undefined;
  secondaryPosition?: string | null | undefined;
  tertiaryPosition?: string | null | undefined;
  /** `Player.bestSide`. Used only as a ±4 modifier for unsided sources → L/R targets. */
  bestSide?: SideInput;
}

export interface SourceContribution {
  declaration: DeclarationSlot;
  rawInput: string;
  normalized: NormalizedSource;
  /** Directed matrix score before any weighting (0–100), or 0 for an unknown source. */
  baseScore: number;
  /** After the declaration multiplier, before the side modifier. */
  weightedScore: number;
  /** The applied best-side modifier (−4 / 0 / +4). */
  sideModifier: number;
  /** Final clamped contribution for this declaration (0–100). */
  finalScore: number;
}

export interface ExactSuitability {
  target: ExactRole;
  /** Effective suitability = max finalScore across declarations (0 when none known). */
  score: number;
  tier: SuitabilityTier;
  /** NATURAL / STRONG / PLAUSIBLE only (§7). */
  automaticallyEligible: boolean;
  /** Per-declaration breakdown, for explanations. */
  bySource: SourceContribution[];
}

function sideModifierFor(
  normalized: Extract<NormalizedSource, { known: true }>,
  targetSide: Lane,
  bestSide: SideInput,
): number {
  if (!UNSIDED_SOURCE_ROLES.has(normalized.role)) return 0;
  if (targetSide === "CENTRE") return 0;
  // An alias that carries an explicit side (LCB/RCB → CB + LEFT/RIGHT) uses that;
  // otherwise fall back to the player's declared bestSide (§1 + §6).
  const side: Lane = normalized.sourceSide ?? normalizeSideInput(bestSide) ?? "CENTRE";
  if (side === "CENTRE") return BEST_SIDE_MODIFIER.center;
  return side === targetSide ? BEST_SIDE_MODIFIER.same : BEST_SIDE_MODIFIER.opposite;
}

const DECLARATION_ORDER: DeclarationSlot[] = ["primary", "secondary", "tertiary"];

function declaredValue(player: DeclaredPositions, slot: DeclarationSlot): string | null | undefined {
  switch (slot) {
    case "primary":
      return player.primaryPosition;
    case "secondary":
      return player.secondaryPosition;
    case "tertiary":
      return player.tertiaryPosition;
  }
}

/**
 * Effective suitability of a player's declared positions for one exact target role.
 * Pure and deterministic.
 */
export function classifyExactSuitability(
  player: DeclaredPositions,
  target: ExactRole,
): ExactSuitability {
  const targetSide = TARGET_ROLE_SIDE[target];
  const bySource: SourceContribution[] = [];

  for (const declaration of DECLARATION_ORDER) {
    const raw = declaredValue(player, declaration);
    if (raw == null || raw.trim() === "") continue;

    const normalized = normalizeSourceRole(raw);
    if (!normalized.known) {
      bySource.push({
        declaration,
        rawInput: raw,
        normalized,
        baseScore: 0,
        weightedScore: 0,
        sideModifier: 0,
        finalScore: 0,
      });
      continue;
    }

    const baseScore = directedMatrixScore(normalized.role, target);
    const weightedScore = baseScore * DECLARATION_MULTIPLIERS[declaration];
    const sideModifier = sideModifierFor(normalized, targetSide, player.bestSide);
    const finalScore = clampScore(weightedScore + sideModifier);

    bySource.push({ declaration, rawInput: raw, normalized, baseScore, weightedScore, sideModifier, finalScore });
  }

  const score = bySource.length > 0 ? Math.max(...bySource.map((s) => s.finalScore)) : 0;
  const tier = tierForScore(score);

  return { target, score, tier, automaticallyEligible: isAutomaticTier(tier), bySource };
}

/**
 * Whether a player is automatically eligible (NATURAL / STRONG / PLAUSIBLE) for a
 * required exact role. This is the single gate exact automatic planning consults —
 * fairness, evidence and tactical fit are applied only to already-eligible
 * candidates, never to widen this.
 */
export function isAutomaticallyEligibleForRole(player: DeclaredPositions, target: ExactRole): boolean {
  return classifyExactSuitability(player, target).automaticallyEligible;
}
