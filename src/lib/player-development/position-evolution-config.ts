/**
 * Centralized configuration for the evolving player-position model
 * (`07_EVOLVING_PLAYER_POSITION_MODEL.md §8/§9`, ADR-0139). One place — never hard-coded inside
 * a route action, a component, or scattered through the evolution engine itself.
 *
 * These are the contract's own fallback values (§9), used because the audit
 * (`docs/implementation/atlas-followup/current-position-model-audit.md`) found no existing
 * equivalent position-evolution stability rule anywhere in the codebase — only a mature,
 * *different* evaluator for POSITION-kind development observations
 * (`evaluatePositionEvidence()` in `position-experience.ts`), whose confidence/direction output
 * this engine reuses directly as one evidence input rather than duplicating (see
 * `effective-position-profile.ts`).
 */
export const POSITION_EVOLUTION_CONFIG = {
  /** How many of a player's most recent completed matches (across League and Event) count as "recent" evidence. */
  recentMatchWindow: 6,
  /** A candidate position needs at least this many completed-match appearances within the window before it can automatically become primary. */
  minAppearancesForAutomaticPromotion: 3,
  /** A candidate must exceed the current primary's support by at least this much (on the engine's internal 0..~1.6 raw-support scale) to be eligible for promotion. */
  promotionSupportMargin: 0.15,
  /** The margin above must hold across this many consecutive evidence recalculations (this one, and the one before it) before a promotion actually happens — hysteresis against a single good/bad match flipping the primary position. */
  persistenceUpdates: 2,
} as const;

/**
 * Initial support contributed by coach declaration alone — establishes rank immediately (contract
 * §5: "player created as ST → ST dot exists immediately") and remains the deciding factor with
 * zero actual evidence. Additive with, not replaced by, actual-usage support.
 */
export const DECLARED_POSITION_SUPPORT = {
  primary: 0.5,
  secondary: 0.3,
  tertiary: 0.15,
} as const;

/**
 * Upper bound of the windowed, recency-weighted actual-usage support contribution (0..1 share of
 * that window, scaled). Deliberately larger than `DECLARED_POSITION_SUPPORT.primary` — sustained,
 * dominant actual usage must be able to clear `promotionSupportMargin` above a declared primary's
 * bonus alone (contract's own worked example: repeated CB usage eventually overtakes a declared
 * ST). A budget only as large as the declared bonus itself (an earlier tuning pass used 0.6
 * against a 0.55 primary bonus) makes automatic promotion mathematically unreachable — caught by
 * `effective-position-profile.test.ts`'s "promotes once a clear margin persists" case.
 */
export const ACTUAL_USAGE_MAX_SUPPORT = 1.0;

/**
 * A small, capped nudge from explicit POSITION-kind development observations
 * (`evaluatePositionEvidence()`), applied only when that evaluator's own confidence is not LOW.
 * Deliberately small relative to `ACTUAL_USAGE_MAX_SUPPORT` — a coach's structured observation
 * reinforces the picture, it does not dominate real match-minute evidence.
 */
export const OBSERVATION_SUPPORT_BONUS = 0.15;

/**
 * Absolute raw-support thresholds mapping to the four green support bands
 * (`06_CANONICAL_PITCH_RENDERING_CONTRACT.md §9`). Self-contained per position (not
 * ranked-relative-to-siblings) so a player with legitimate support at only one position still
 * gets a meaningful band for that position, not an artificial "always strongest" placeholder.
 */
export const SUPPORT_BAND_THRESHOLDS = {
  strongest: 0.9,
  strong: 0.6,
  established: 0.35,
  // anything > 0 and below `established` is LIMITED.
} as const;

/** Appearance-count thresholds for confidence, applied to windowed actual-usage appearances only. */
export const CONFIDENCE_APPEARANCE_THRESHOLDS = {
  high: 3,
  medium: 1,
  // 0 appearances (declaration/observation only) is LOW.
} as const;
