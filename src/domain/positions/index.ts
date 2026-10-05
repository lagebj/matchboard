// ─────────────────────────────────────────────────────────────────
// Positional-semantics domain owner (ADR-0129, extended by ADR-0154).
//
// The single owner of tactical-position semantics: the canonical 24-code
// vocabulary and 5x6 grid (ADR-0154), exact football-role semantics for
// AUTOMATIC PLANNING (ADR-0129, now projected from the 24-code vocabulary
// via a compatibility projection — the suitability matrix itself is never
// regenerated), alias normalization, tiers + automatic-eligibility
// threshold, the best-side modifier, formation-slot → canonical-position
// derivation, player → target-role suitability, and neutral fit labels.
//
// Exact-planning callers (starting-lineup generation, rotation
// generation, emergency repair, exact formation coverage) must import
// from here and must not re-implement any of this. Broad-role helpers
// elsewhere remain valid ONLY for genuinely broad questions.
// ─────────────────────────────────────────────────────────────────

// The old 12-code `EXACT_ROLES`/`ExactRole`/`isExactRole`/`TARGET_ROLE_SIDE` (ADR-0129) are no
// longer part of this module's public surface (ADR-0154 step A9) -- every external caller has
// migrated to the canonical 24-code vocabulary below. They remain available only via a direct
// `./roles` import for the matrix/projection internals and one still-correct deep import
// (`src/lib/selection/emergency-repair-options.ts`, which filters the suitability matrix's own
// base-role space -- unaffected by the canonical-vocabulary widening, see that file's comment).
export {
  SOURCE_ROLES,
  UNSIDED_SOURCE_ROLES,
  isSourceRole,
  normalizeSideInput,
  CANONICAL_TACTICAL_POSITIONS,
  BROAD_TACTICAL_POSITIONS,
  UNSIDED_CENTRE_LINE_POSITIONS,
  CENTRE_LINE_TRIPLES,
  isCanonicalTacticalPosition,
  isBroadTacticalPosition,
  isUnsidedCentreLinePosition,
  type SourceRole,
  type Lane,
  type SideInput,
  type CanonicalTacticalPosition,
  type BroadTacticalPosition,
  type UnsidedCentreLinePosition,
} from "./roles";

export {
  canonicalPositionForCell,
  validFormationCellsFor,
  primaryDisplayCellFor,
  type GridCell,
} from "./grid";

export {
  normalizeCanonicalPosition,
} from "./canonical-aliases";

export {
  canonicalFullLabel,
  canonicalCompactLabel,
} from "./canonical-labels";

export {
  projectToBaseRole,
  type BaseRoleProjection,
  type SuitabilityTargetRole,
  type LegacyTargetAlias,
} from "./compatibility-projection";

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
