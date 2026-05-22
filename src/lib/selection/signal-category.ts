// Client-safe signal category mappings.
// This module must NOT import from @/generated/prisma/client or @/lib/db
// because it is used in Client Components.

export type SignalCategory = "BLOCKED" | "DECISION_REQUIRED" | "PLANNING_NOTE";

// These values mirror the WarningSeverity Prisma enum but are defined here
// to keep this module client-safe (no Prisma or DB imports).
export type WarningSeverityValue =
  | "HARD_BLOCK"
  | "REQUIRES_OVERRIDE"
  | "WARNING"
  | "SCORING_PREFERENCE";

// Blocked conditions — the planned round or match is invalid or not viable
const HARD_BLOCK_CODES = new Set([
  "player_in_multiple_matches",
  "duplicate_player_in_match",
  "invariant_invalid_non_core_selection",
  "squad_below_minimum",
  "selected_player_unavailable",
  "duplicate_planned_assignment_integrity_failure",
]);

// Decision required conditions — a meaningful exception must be consciously accepted
const REQUIRES_OVERRIDE_CODES = new Set([
  "support_requirement_shortfall",
  "squad_repair_shortfall_after_resolution",
  "repair_requires_override",
  "repair_below_minimum",
  "squad_repair_no_path_available",
  "round_player_conflict_removed",
  "available_player_without_planned_opportunity",
]);

// Planning notes — useful context; the plan remains valid and finalisable
const WARNING_CODES = new Set([
  "support_shortfall_after_resolution",
  "support_below_target",
  "squad_repair_below_target",
  "short_squad",
  "core_player_unselected",
  "support_avoid_suitability",
  "support_no_show_history",
  "unknown_availability_support",
  "tentative_availability",
  "position_mismatch",
  "repair_no_replacement_target_shortfall",
  "support_target_not_reached",
  "below_target_but_playable",
  "preferred_support_not_met",
  "squad_repair_below_preferred_target",
  "fallback_position_used",
  "double_load_exceeded_max",
  "double_load_squad_full",
]);

// Scoring preferences — explanation only, never persisted as active issues
const SCORING_PREFERENCE_CODES = new Set([
  "core_player_overflow",
  "development_slot_shortfall",
  "support_backfill_priority",
  "player_locked_in_blocked",
  "round_support_resolution",
  "support_priority_order",
  "core_match_drop_for_support",
  "core_match_drop_routed",
  "core_match_drop_priority",
  "self_squad_repair",
  "squad_repair_priority_1_own_support",
  "squad_repair_priority_2_path_player",
  "squad_repair_priority_3_other",
  "controlled_double_load",
  "double_load_insufficient_rest",
  "registered_match_conflict",
  "registered_minimum_match_spacing",
  "round_player_conflict",
  "round_conflict_demoted",
  "readiness_effort_trend",
  "readiness_attendance_reliability",
  "readiness_learning_behavior",
  "readiness_team_first_behavior",
  "readiness_reset_after_error_reliability",
  "readiness_coach_trust",
]);

export function mapWarningSeverity(code: string): WarningSeverityValue {
  if (HARD_BLOCK_CODES.has(code)) return "HARD_BLOCK";
  if (REQUIRES_OVERRIDE_CODES.has(code)) return "REQUIRES_OVERRIDE";
  if (WARNING_CODES.has(code)) return "WARNING";
  if (SCORING_PREFERENCE_CODES.has(code)) return "SCORING_PREFERENCE";
  return "WARNING";
}

export function mapToSignalCategory(code: string): SignalCategory {
  if (HARD_BLOCK_CODES.has(code)) return "BLOCKED";
  if (REQUIRES_OVERRIDE_CODES.has(code)) return "DECISION_REQUIRED";
  if (WARNING_CODES.has(code)) return "PLANNING_NOTE";
  return "PLANNING_NOTE";
}

export function signalCategoryFromSeverity(severity: WarningSeverityValue): SignalCategory {
  switch (severity) {
    case "HARD_BLOCK":
      return "BLOCKED";
    case "REQUIRES_OVERRIDE":
      return "DECISION_REQUIRED";
    case "WARNING":
      return "PLANNING_NOTE";
    case "SCORING_PREFERENCE":
      return "PLANNING_NOTE";
  }
}

export function signalCategoryLabel(category: SignalCategory): string {
  switch (category) {
    case "BLOCKED":
      return "Blocked";
    case "DECISION_REQUIRED":
      return "Decision required";
    case "PLANNING_NOTE":
      return "Planning note";
  }
}