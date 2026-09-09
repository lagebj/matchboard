/**
 * Shared, client-safe structured reason model for coach-facing recommendation explanations
 * (Consolidation Programme C6 / F6). Consumable by squad selection, lineup generation, and
 * rotation generation — one vocabulary, one prose owner (`@/lib/formatters/recommendation-reason-text`).
 *
 * Rules (F6 / PRINCIPLES.md #8, and AGENTS.md "Explanation model" / coach-facing language):
 *  - Structured `code` + `category`, never algorithm-generated prose in the engine.
 *  - `params` carry counts / minutes / tiers only — NEVER a raw score, weight, or delta.
 *  - Neutral language only; no player ranking; unknown evidence never produces negative wording.
 *  - No `@/lib/db`, no `@/generated/prisma` import here — this is importable from client components,
 *    matching `signal-category.ts`.
 */

/** The five material reason families (F6 / PROGRAMME.md C6). */
export type ReasonCategory =
  | "HARD_CONSTRAINT" // eligibility, availability, invariant, goalkeeper boundary, pin
  | "FAIRNESS_OPPORTUNITY" // under-share, recent load, missed opportunity, consecutive-support rotation
  | "ROLE_POSITION_SUITABILITY" // declared-position fit tier, realised-exposure tier, formation-slot fit
  | "OPPONENT_EVIDENCE_CONTEXT" // opponent tendency/function, partnership/combination, position-context, transition-structure
  | "DOWNSTREAM_COVERAGE"; // support requirement, squad repair, development routing, coverage impact of THIS pick

export type ReasonCode =
  // HARD_CONSTRAINT
  | "ELIGIBILITY_ROTATION_PATH"
  | "AVAILABILITY"
  | "PINNED_IN"
  | "PINNED_OUT"
  | "GOALKEEPER_BOUNDARY"
  | "PATH_COOLDOWN"
  | "NON_ROTATABLE"
  // FAIRNESS_OPPORTUNITY
  | "FAIRNESS_UNDER_SHARE"
  | "RECENT_LOAD"
  | "MISSED_CORE_OPPORTUNITY"
  | "CONSECUTIVE_SUPPORT_ROTATION"
  // ROLE_POSITION_SUITABILITY
  | "POSITION_PRIMARY_FIT"
  | "POSITION_SECONDARY_FIT"
  | "POSITION_FALLBACK_FIT"
  | "POSITION_NO_FIT"
  | "ROLE_EXPOSURE_SUPPORTS"
  // OPPONENT_EVIDENCE_CONTEXT
  | "OPPONENT_FUNCTION_CONTINUITY"
  | "PARTNERSHIP_EVIDENCE"
  | "COMBINATION_EVIDENCE"
  | "POSITION_CONTEXT_HISTORY"
  | "TRANSITION_STRUCTURE_CONTEXT"
  // DOWNSTREAM_COVERAGE
  | "SUPPORT_REQUIREMENT"
  | "SQUAD_REPAIR"
  | "DEVELOPMENT_ROUTING"
  | "COVERAGE_RISK"
  // generic timing context (rotation)
  | "NATURAL_BREAK";

/** Replaces the ad-hoc `hardRule` boolean: a reason either constrains, supports, or cautions. */
export type ReasonPolarity = "CONSTRAINT" | "SUPPORTING" | "CAUTION";

/** Shared with every evidence signal in the programme. */
export type EvidenceConfidence = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";

export type RecommendationReason = {
  code: ReasonCode;
  /** Always derivable from `code` via `CODE_TO_CATEGORY` — carried for convenient grouping. */
  category: ReasonCategory;
  polarity: ReasonPolarity;
  /** Present only for evidence-derived reasons. */
  confidence?: EvidenceConfidence;
  /**
   * Counts / minutes / tier labels the prose formatter interpolates — NEVER a score/weight/delta.
   * e.g. `{ minutesBehind: 6 }`, `{ tier: "NATURAL" }`, `{ matchCount: 3 }`.
   */
  params?: Record<string, string | number>;
  /**
   * The engine marks the few reasons that actually moved this decision — UI features these and
   * may collapse the rest.
   */
  material: boolean;
};

export const CODE_TO_CATEGORY: Record<ReasonCode, ReasonCategory> = {
  ELIGIBILITY_ROTATION_PATH: "HARD_CONSTRAINT",
  AVAILABILITY: "HARD_CONSTRAINT",
  PINNED_IN: "HARD_CONSTRAINT",
  PINNED_OUT: "HARD_CONSTRAINT",
  GOALKEEPER_BOUNDARY: "HARD_CONSTRAINT",
  PATH_COOLDOWN: "HARD_CONSTRAINT",
  NON_ROTATABLE: "HARD_CONSTRAINT",

  FAIRNESS_UNDER_SHARE: "FAIRNESS_OPPORTUNITY",
  RECENT_LOAD: "FAIRNESS_OPPORTUNITY",
  MISSED_CORE_OPPORTUNITY: "FAIRNESS_OPPORTUNITY",
  CONSECUTIVE_SUPPORT_ROTATION: "FAIRNESS_OPPORTUNITY",

  POSITION_PRIMARY_FIT: "ROLE_POSITION_SUITABILITY",
  POSITION_SECONDARY_FIT: "ROLE_POSITION_SUITABILITY",
  POSITION_FALLBACK_FIT: "ROLE_POSITION_SUITABILITY",
  POSITION_NO_FIT: "ROLE_POSITION_SUITABILITY",
  ROLE_EXPOSURE_SUPPORTS: "ROLE_POSITION_SUITABILITY",

  OPPONENT_FUNCTION_CONTINUITY: "OPPONENT_EVIDENCE_CONTEXT",
  PARTNERSHIP_EVIDENCE: "OPPONENT_EVIDENCE_CONTEXT",
  COMBINATION_EVIDENCE: "OPPONENT_EVIDENCE_CONTEXT",
  POSITION_CONTEXT_HISTORY: "OPPONENT_EVIDENCE_CONTEXT",
  TRANSITION_STRUCTURE_CONTEXT: "OPPONENT_EVIDENCE_CONTEXT",

  SUPPORT_REQUIREMENT: "DOWNSTREAM_COVERAGE",
  SQUAD_REPAIR: "DOWNSTREAM_COVERAGE",
  DEVELOPMENT_ROUTING: "DOWNSTREAM_COVERAGE",
  COVERAGE_RISK: "DOWNSTREAM_COVERAGE",

  NATURAL_BREAK: "OPPONENT_EVIDENCE_CONTEXT",
};

export function reasonCategory(code: ReasonCode): ReasonCategory {
  return CODE_TO_CATEGORY[code];
}

/** Convenience constructor — fills `category` from `code`. */
export function buildReason(
  code: ReasonCode,
  opts?: {
    polarity?: ReasonPolarity;
    confidence?: EvidenceConfidence;
    params?: Record<string, string | number>;
    material?: boolean;
  },
): RecommendationReason {
  return {
    code,
    category: CODE_TO_CATEGORY[code],
    polarity: opts?.polarity ?? "SUPPORTING",
    confidence: opts?.confidence,
    params: opts?.params,
    material: opts?.material ?? false,
  };
}

/**
 * Bridge for the ~40 legacy snake_case `ExplanationRecord.code` values still emitted by squad
 * selection (`buildExplanation` in `generate-selection.ts` / `resolve-round-support.ts` /
 * `generate-round.ts`). Lets that data be classified into the shared category vocabulary now,
 * ahead of a staged migration of its emission path onto `RecommendationReason` (ADR-0128). An
 * unrecognised code returns `null` (caller keeps the raw code's own prose).
 */
const LEGACY_CODE_TO_CATEGORY: Record<string, ReasonCategory> = {
  availability_rule: "HARD_CONSTRAINT",
  inactive_player: "HARD_CONSTRAINT",
  unknown_availability: "HARD_CONSTRAINT",
  rotation_path_allowed: "HARD_CONSTRAINT",
  target_team_eligibility: "HARD_CONSTRAINT",
  path_cooldown_active: "HARD_CONSTRAINT",
  player_locked_in: "HARD_CONSTRAINT",
  player_locked_out: "HARD_CONSTRAINT",
  eligible_core_player: "ROLE_POSITION_SUITABILITY",
  position_mismatch: "ROLE_POSITION_SUITABILITY",
  position_secondary_match: "ROLE_POSITION_SUITABILITY",
  position_tertiary_match: "ROLE_POSITION_SUITABILITY",
  support_avoid_suitability: "ROLE_POSITION_SUITABILITY",
  registered_match_fairness: "FAIRNESS_OPPORTUNITY",
  same_week_missed_core_priority: "FAIRNESS_OPPORTUNITY",
  development_not_ready: "FAIRNESS_OPPORTUNITY",
  development_priority_over_core: "FAIRNESS_OPPORTUNITY",
  combination_evidence: "OPPONENT_EVIDENCE_CONTEXT",
  team_support_requirement: "DOWNSTREAM_COVERAGE",
  team_support_slots_reserved: "DOWNSTREAM_COVERAGE",
  team_development_slots_reserved: "DOWNSTREAM_COVERAGE",
  support_priority_over_core: "DOWNSTREAM_COVERAGE",
  support_development_then_core_priority: "DOWNSTREAM_COVERAGE",
  support_priority_order: "DOWNSTREAM_COVERAGE",
  round_support_resolution: "DOWNSTREAM_COVERAGE",
  core_match_drop_for_support: "DOWNSTREAM_COVERAGE",
  core_match_drop_routed: "DOWNSTREAM_COVERAGE",
  indirect_support_backfill: "DOWNSTREAM_COVERAGE",
  squad_repair_priority_1_own_support: "DOWNSTREAM_COVERAGE",
  squad_repair_priority_2_path_player: "DOWNSTREAM_COVERAGE",
  squad_repair_priority_3_other: "DOWNSTREAM_COVERAGE",
  self_squad_repair: "DOWNSTREAM_COVERAGE",
};

export function classifyExplanationCode(code: string): ReasonCategory | null {
  return LEGACY_CODE_TO_CATEGORY[code] ?? null;
}

/**
 * Finer map: a legacy squad-selection `ExplanationRecord.code` → a `ReasonCode`. Lets the
 * generation engine attach a structured `RecommendationReason` to every explanation it already
 * emits (C6 staging, ADR-0128) without rewriting its prose. `undefined` when a code has no
 * clean 1:1 (the caller keeps just the prose).
 */
const LEGACY_CODE_TO_REASON_CODE: Record<string, ReasonCode> = {
  availability_rule: "AVAILABILITY",
  unknown_availability: "AVAILABILITY",
  inactive_player: "AVAILABILITY",
  rotation_path_allowed: "ELIGIBILITY_ROTATION_PATH",
  target_team_eligibility: "ELIGIBILITY_ROTATION_PATH",
  path_cooldown_active: "PATH_COOLDOWN",
  player_locked_in: "PINNED_IN",
  player_locked_out: "PINNED_OUT",
  registered_match_fairness: "FAIRNESS_UNDER_SHARE",
  same_week_missed_core_priority: "MISSED_CORE_OPPORTUNITY",
  development_not_ready: "DEVELOPMENT_ROUTING",
  development_priority_over_core: "DEVELOPMENT_ROUTING",
  development_routing: "DEVELOPMENT_ROUTING",
  position_secondary_match: "POSITION_SECONDARY_FIT",
  position_tertiary_match: "POSITION_FALLBACK_FIT",
  position_mismatch: "POSITION_NO_FIT",
  support_avoid_suitability: "POSITION_NO_FIT",
  combination_evidence: "COMBINATION_EVIDENCE",
  team_support_requirement: "SUPPORT_REQUIREMENT",
  team_support_slots_reserved: "SUPPORT_REQUIREMENT",
  support_priority_over_core: "SUPPORT_REQUIREMENT",
  support_development_then_core_priority: "SUPPORT_REQUIREMENT",
  support_priority_order: "SUPPORT_REQUIREMENT",
  round_support_resolution: "SUPPORT_REQUIREMENT",
  indirect_support_backfill: "SUPPORT_REQUIREMENT",
  team_development_slots_reserved: "DEVELOPMENT_ROUTING",
  core_match_drop_for_support: "SQUAD_REPAIR",
  core_match_drop_routed: "SQUAD_REPAIR",
  squad_repair_priority_1_own_support: "SQUAD_REPAIR",
  squad_repair_priority_2_path_player: "SQUAD_REPAIR",
  squad_repair_priority_3_other: "SQUAD_REPAIR",
  self_squad_repair: "SQUAD_REPAIR",
};

/**
 * Build a structured reason from a legacy `ExplanationRecord`. Returns `undefined` for a code
 * that has no `ReasonCode` mapping yet (e.g. `eligible_core_player`, `registered_match_conflict`)
 * — the caller keeps the record's own prose.
 */
export function reasonFromLegacyExplanation(
  code: string,
  hardRule?: boolean,
): RecommendationReason | undefined {
  const reasonCode = LEGACY_CODE_TO_REASON_CODE[code];
  if (!reasonCode) return undefined;
  return buildReason(reasonCode, {
    polarity: hardRule ? "CONSTRAINT" : "SUPPORTING",
    material: true,
  });
}
