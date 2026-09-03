// ─────────────────────────────────────────────────────────────────
// Outfield role suitability and tactical-function fit.
//
// Evidence-Informed Match Planning programme, Bundle 5 (ADR-0116).
// Extends the existing position-suitability owner (position-suitability.ts)
// with a second, evidence-aware view: whether a player's declared position
// and demonstrated exposure make an outfield role NATURAL, PLAUSIBLE,
// DEVELOPMENTAL, or UNSUPPORTED — so automatic planning is not forced to
// treat a declared position as a rigid queue (the "five-striker case",
// PROGRAMME.md).
//
// Deliberately NOT built on RoleSuitabilityProfile/getPositionFit()
// directly (see ADR-0116): that function's existing "a role accepting
// 'flexible' can be filled by any player, at TERTIARY fit" floor is
// correct and load-bearing for team-composition's cross-team-fill
// problem (every player must land somewhere), but it makes NO_FIT
// structurally unreachable for DEFENCE/MIDFIELD/ATTACK/FLEXIBLE — every
// player gets at least TERTIARY there. That floor would make UNSUPPORTED
// unreachable here too, defeating the five-striker case's whole point.
// This module instead compares each player's own declared broad
// positions against the target role directly, with no floor — reusing
// only the genuinely shared primitives (BroadPosition,
// STRUCTURAL_ROLE_TO_BROAD_POSITION, mapPositionCodeToBroad), not a
// second position-mapping engine.
//
// Pure and DB-free throughout: callers (e.g.
// src/lib/players/get-player-outfield-role-suitability.ts) supply
// already-resolved declared broad positions and exposure-evidence
// summaries; this module never queries the database itself.
//
// Goalkeeper boundary (AGENTS.md, D-011): OutfieldStructuralRole
// excludes GOALKEEPER at the type level. This module can never express
// a goalkeeper suitability claim, by construction, regardless of a
// player's attributes or goalkeeperAbility.
// ─────────────────────────────────────────────────────────────────

import {
  OUTFIELD_STRUCTURAL_ROLES,
  STRUCTURAL_ROLE_TO_BROAD_POSITION,
  TACTICAL_FUNCTION_CODES,
  type BroadPosition,
  type OutfieldStructuralRole,
  type OutfieldEvidenceConfidence,
  type OutfieldPositionExposureEvidence,
  type OutfieldRoleSuitabilityResult,
  type PositionFitTier,
  type TacticalFunctionCode,
  type TacticalFunctionFit,
  type TacticalFunctionFitTier,
} from "./team-composition-types";

export interface DeclaredBroadPositions {
  primary: BroadPosition;
  secondary?: BroadPosition;
  tertiary?: BroadPosition;
}

function declaredFitForOutfieldRole(role: OutfieldStructuralRole, declared: DeclaredBroadPositions): PositionFitTier {
  const targetBroad = STRUCTURAL_ROLE_TO_BROAD_POSITION[role];
  if (declared.primary === targetBroad || declared.primary === "flexible") return "PRIMARY";
  if (declared.secondary && (declared.secondary === targetBroad || declared.secondary === "flexible")) return "SECONDARY";
  if (declared.tertiary && (declared.tertiary === targetBroad || declared.tertiary === "flexible")) return "TERTIARY";
  return "NO_FIT";
}

// ── Exposure confidence ──────────────────────────────────────────────
//
// Same match-count thresholds as match-phase-pattern-evidence.ts's
// classifyMatchPhaseConfidence() (<3 INSUFFICIENT, 3-5 EMERGING, 6+
// ESTABLISHED) — declared independently per this domain directory's
// decoupling convention (see team-composition-types.ts), not imported.

export function classifyExposureConfidence(matchCount: number): OutfieldEvidenceConfidence {
  if (matchCount >= 6) return "ESTABLISHED";
  if (matchCount >= 3) return "EMERGING";
  return "INSUFFICIENT";
}

// ── Outfield role suitability ────────────────────────────────────────

export function classifyOutfieldRoleSuitability(
  role: OutfieldStructuralRole,
  declaredFit: PositionFitTier,
  exposure: OutfieldPositionExposureEvidence,
): OutfieldRoleSuitabilityResult {
  const exposureMatchCount = exposure.matchCountByRole[role] ?? 0;
  const exposureConfidence = classifyExposureConfidence(exposureMatchCount);

  if (declaredFit === "PRIMARY") {
    return {
      role,
      tier: "NATURAL",
      declaredFit,
      exposureConfidence,
      exposureMatchCount,
      explanation: "Primary declared position",
    };
  }

  if (declaredFit === "SECONDARY" || declaredFit === "TERTIARY") {
    return {
      role,
      tier: "PLAUSIBLE",
      declaredFit,
      exposureConfidence,
      exposureMatchCount,
      explanation: declaredFit === "SECONDARY" ? "Secondary declared position" : "Tertiary declared position",
    };
  }

  // NO_FIT — no declared support for this role. Demonstrated exposure evidence (not fairness
  // need, not coach convenience) is the only thing that can still make this role usable.
  if (exposureConfidence !== "INSUFFICIENT") {
    const matches = `${exposureMatchCount} match${exposureMatchCount === 1 ? "" : "es"}`;
    return {
      role,
      tier: "DEVELOPMENTAL",
      declaredFit,
      exposureConfidence,
      exposureMatchCount,
      explanation: `No declared fit, but ${matches} of recorded exposure in this role (${exposureConfidence.toLowerCase()})`,
    };
  }

  return {
    role,
    tier: "UNSUPPORTED",
    declaredFit,
    exposureConfidence,
    exposureMatchCount,
    explanation: "No declared fit and no recorded exposure in this role",
  };
}

export function computeOutfieldRoleSuitabilityProfile(
  declared: DeclaredBroadPositions,
  exposure: OutfieldPositionExposureEvidence,
): OutfieldRoleSuitabilityResult[] {
  return OUTFIELD_STRUCTURAL_ROLES.map((role) => {
    const declaredFit = declaredFitForOutfieldRole(role, declared);
    return classifyOutfieldRoleSuitability(role, declaredFit, exposure);
  });
}

// ── Tactical function fit ────────────────────────────────────────────
//
// Derived only from explicit player attributes and the role-suitability
// gate above — never a vague AI label (PROGRAMME.md "Tactical
// functions"). A function is NOT_APPLICABLE for a player whose
// outfield-role suitability is UNSUPPORTED in every role the function
// requires, regardless of raw attribute values.

interface TacticalFunctionDefinition {
  applicableRoles: readonly OutfieldStructuralRole[];
  /** Weighted 1-10 attribute average. Keys match Player's own raw attribute field names. */
  weights: Readonly<Record<string, number>>;
}

const TACTICAL_FUNCTION_DEFINITIONS: Record<TacticalFunctionCode, TacticalFunctionDefinition> = {
  FIRST_LINE_PRESS: {
    applicableRoles: ["ATTACK", "MIDFIELD"],
    weights: { effort: 0.35, concentration: 0.2, speed: 0.25, decisionMaking: 0.2 },
  },
  PACE_IN_BEHIND: {
    applicableRoles: ["ATTACK"],
    weights: { speed: 0.5, oneVOneAttacking: 0.3, decisionMaking: 0.2 },
  },
  HOLD_UP_LINK_PLAY: {
    applicableRoles: ["ATTACK", "MIDFIELD"],
    weights: { ballControl: 0.3, firstTouch: 0.25, teamplay: 0.25, passing: 0.2 },
  },
  CENTRAL_DEFENSIVE_CONTINUITY: {
    applicableRoles: ["DEFENCE"],
    weights: { oneVOneDefending: 0.35, positioning: 0.3, concentration: 0.2, decisionMaking: 0.15 },
  },
  BALL_PROGRESSION: {
    applicableRoles: ["MIDFIELD", "DEFENCE"],
    weights: { passing: 0.4, decisionMaking: 0.3, ballControl: 0.3 },
  },
  WIDTH: {
    applicableRoles: ["MIDFIELD", "ATTACK"],
    weights: { speed: 0.4, teamplay: 0.3, positioning: 0.3 },
  },
};

export interface TacticalFunctionAttributes {
  ballControl?: number | null;
  passing?: number | null;
  firstTouch?: number | null;
  oneVOneAttacking?: number | null;
  positioning?: number | null;
  oneVOneDefending?: number | null;
  decisionMaking?: number | null;
  effort?: number | null;
  teamplay?: number | null;
  concentration?: number | null;
  speed?: number | null;
  strength?: number | null;
}

function isRoleApplicable(role: OutfieldStructuralRole, outfieldProfile: readonly OutfieldRoleSuitabilityResult[]): boolean {
  const result = outfieldProfile.find((r) => r.role === role);
  return result !== undefined && result.tier !== "UNSUPPORTED";
}

export function computeTacticalFunctionFit(
  code: TacticalFunctionCode,
  attributes: TacticalFunctionAttributes,
  outfieldProfile: readonly OutfieldRoleSuitabilityResult[],
): TacticalFunctionFit {
  const definition = TACTICAL_FUNCTION_DEFINITIONS[code];
  const applicable = definition.applicableRoles.some((role) => isRoleApplicable(role, outfieldProfile));
  if (!applicable) {
    return { function: code, tier: "NOT_APPLICABLE", score: null };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of Object.entries(definition.weights)) {
    const value = attributes[attr as keyof TacticalFunctionAttributes];
    if (value !== null && value !== undefined) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return { function: code, tier: "NOT_APPLICABLE", score: null };
  }

  const score = Math.round((weightedSum / totalWeight) * 10) / 10;
  const tier: TacticalFunctionFitTier = score >= 7 ? "STRONG_FIT" : score >= 5 ? "MODERATE_FIT" : "WEAK_FIT";
  return { function: code, tier, score };
}

export function computeTacticalFunctionProfile(
  attributes: TacticalFunctionAttributes,
  outfieldProfile: readonly OutfieldRoleSuitabilityResult[],
): TacticalFunctionFit[] {
  return TACTICAL_FUNCTION_CODES.map((code) => computeTacticalFunctionFit(code, attributes, outfieldProfile));
}
