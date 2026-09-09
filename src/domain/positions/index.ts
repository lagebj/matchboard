// ─────────────────────────────────────────────────────────────────
// Exact positional-semantics domain owner (ADR-0129).
//
// The single owner of exact football-role semantics for AUTOMATIC
// PLANNING: canonical roles, alias normalization, the directed
// suitability matrix, tiers + automatic-eligibility threshold, the
// best-side modifier, formation-slot → exact target-role derivation,
// player → target-role suitability, and neutral fit labels.
//
// Exact-planning callers (starting-lineup generation, rotation
// generation, emergency repair, exact formation coverage) must import
// from here and must not re-implement any of this. Broad-role helpers
// elsewhere remain valid ONLY for genuinely broad questions.
// ─────────────────────────────────────────────────────────────────

export {
  EXACT_ROLES,
  SOURCE_ROLES,
  TARGET_ROLE_SIDE,
  UNSIDED_SOURCE_ROLES,
  isExactRole,
  isSourceRole,
  normalizeSideInput,
  type ExactRole,
  type SourceRole,
  type Lane,
  type SideInput,
} from "./roles";

export {
  normalizeSourceRole,
  isEmptyDeclaration,
  type NormalizedSource,
} from "./aliases";

export {
  AUTOMATIC_ELIGIBLE_TIERS,
  BEST_SIDE_MODIFIER,
  DECLARATION_MULTIPLIERS,
  MATRIX_TARGETS,
  MATRIX_VERSION,
  clampScore,
  directedMatrixScore,
  isAutomaticTier,
  tierForScore,
  type SuitabilityTier,
} from "./matrix";

export {
  deriveExactTargetRole,
  slotHasExactAutomaticTarget,
} from "./slot-target";

export {
  classifyExactSuitability,
  isAutomaticallyEligibleForRole,
  type DeclaredPositions,
  type DeclarationSlot,
  type ExactSuitability,
  type SourceContribution,
} from "./suitability";

export {
  FIT_TIER_LABEL,
  UNSUPPORTED_CONFIRMATION,
  developmentalAnnotation,
  fitLabel,
  requiresUnsupportedConfirmation,
} from "./labels";
