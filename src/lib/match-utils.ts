import type { MatchVenue, SelectionRole } from "@/generated/prisma/client";
import { COACHING_INTENT_LABELS, MATCHDAY_RESPONSIBILITY_LABELS, READINESS_SIGNAL_LABELS, FEEDBACK_CATEGORY_LABELS, FEEDBACK_VALUE_LABELS, NEXT_ACTION_LABELS } from "@/lib/coaching/types";

export function formatMatchVenue(venue: MatchVenue): string {
  return venue === "HOME" ? "Home" : "Away";
}

export function formatSelectionRole(role: SelectionRole): string {
  switch (role) {
    case "CORE":
      return "Core";
    case "SUPPORT":
      return "Support";
    case "DEVELOPMENT":
      return "Development";
    case "BACKFILL":
      return "Squad Repair";
    case "CONFIDENCE_REBUILD":
      return "Confidence Rebuild";
    case "CORE_MATCH_DROP":
      return "Core Drop";
    case "REDUCED_MATCH_LOAD_DROP":
      return "Reduced Load Drop";
    case "MANUAL_OVERRIDE":
      return "Manual Override";
  }
}

type ExplanationRecord = {
  summary?: string;
  records?: Array<{ summary?: string }>;
  [key: string]: unknown;
};

export function formatExplanation(explanation: unknown): string {
  if (typeof explanation === "string") return explanation;
  if (!explanation || typeof explanation !== "object") return "";
  const obj = explanation as ExplanationRecord;
  if (typeof obj.summary === "string" && obj.summary) return obj.summary;
  if (Array.isArray(obj.records) && obj.records.length > 0) {
    const summaries = obj.records
      .map((r) => (typeof r?.summary === "string" ? r.summary : ""))
      .filter(Boolean);
    if (summaries.length > 0) return summaries.join(". ");
  }
  return "";
}

export function formatWarningCode(code: string): string {
  const labels: Record<string, string> = {
    core_player_overflow: "Core player overflow",
    core_player_unselected: "Core player not selected",
    support_backfill_priority: "Support backfill priority",
    support_shortfall_after_resolution: "Support shortfall",
    support_below_target: "Support below target",
    squad_repair_no_path_available: "No squad repair path",
    squad_repair_priority_1_own_support: "Squad repair: own support player",
    squad_repair_priority_2_path_player: "Squad repair: path player",
    squad_repair_priority_3_other: "Squad repair: other player",
    squad_repair_shortfall_after_resolution: "Squad too small after repair",
    squad_repair_below_target: "Squad below target after repair",
    short_squad: "Short squad",
    player_in_multiple_matches: "Player in multiple matches",
    duplicate_player_in_match: "Duplicate player in match",
    round_player_conflict: "Round player conflict",
    round_conflict_demoted: "Conflict demoted",
    registered_match_conflict: "Registered match conflict",
    registered_minimum_match_spacing: "Insufficient match spacing",
    development_not_ready: "Not ready for development",
    support_avoid_suitability: "Player avoids support",
    player_locked_in_blocked: "Player blocked",
    round_support_resolution: "Round support resolution",
    support_priority_order: "Support priority order",
    core_match_drop_for_support: "Dropped for support",
    core_match_drop_routed: "Core match drop routed",
    core_match_drop_priority: "Core match drop priority",
    self_squad_repair: "Self squad repair",
    position_mismatch: "Position mismatch",
    controlled_double_load: "Controlled double load",
    double_load_exceeded_max: "Double load exceeded max",
    double_load_squad_full: "Double load: squad full",
    double_load_insufficient_rest: "Double load: insufficient rest",
    readiness_effort_trend: "Effort trend falling",
    readiness_attendance_reliability: "Low attendance reliability",
    readiness_learning_behavior: "Learning behavior needs attention",
    readiness_team_first_behavior: "Team-first behavior needs attention",
    readiness_reset_after_error_reliability: "Reset-after-error needs attention",
    readiness_coach_trust: "Low coach trust",
  };
  return labels[code] ?? code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSeverity(severity: string): string {
  switch (severity) {
    case "HARD_BLOCK": return "Blocking";
    case "REQUIRES_OVERRIDE": return "Requires override";
    case "WARNING": return "Warning";
    case "SCORING_PREFERENCE": return "Preference";
    default: return severity;
  }
}

export function formatCoachingIntent(category: string): string {
  return (COACHING_INTENT_LABELS as Record<string, string>)[category] ?? category.replace(/_/g, " ").toLowerCase();
}

export function formatMatchdayResponsibility(resp: string): string {
  return (MATCHDAY_RESPONSIBILITY_LABELS as Record<string, string>)[resp] ?? resp;
}

export function formatReadinessSignalType(signalType: string): string {
  return (READINESS_SIGNAL_LABELS as Record<string, string>)[signalType] ?? signalType.replace(/_/g, " ").toLowerCase();
}

export function formatFeedbackCategory(category: string): string {
  return (FEEDBACK_CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

export function formatFeedbackValue(value: string): string {
  return (FEEDBACK_VALUE_LABELS as Record<string, string>)[value] ?? value;
}

export function formatNextAction(action: string): string {
  return (NEXT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

export function formatAttendanceStatus(status: string): string {
  switch (status) {
    case "PRESENT": return "Present";
    case "NO_SHOW": return "No-show";
    case "UNKNOWN": return "Unknown";
    default: return status;
  }
}

export const OVERRIDE_REASON_CATEGORY_LABELS: Record<string, string> = {
  squad_too_small: "Squad too small",
  support_missing: "Support missing",
  development_opportunity: "Development opportunity",
  double_load_needed: "Double load needed",
  availability_changed: "Availability changed",
  coach_judgement: "Coach judgement",
  match_already_played: "Match already played",
  data_correction: "Data correction",
  other: "Other",
};

export function formatOverrideReasonCategory(category: string): string {
  return OVERRIDE_REASON_CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

// A floating role is any non-core role where the player is movement-eligible.
// BACKFILL, CONFIDENCE_REBUILD, CORE_MATCH_DROP, and REDUCED_MATCH_LOAD_DROP
// are legacy roles retained for backward compatibility with historical data.
// New generation only produces SUPPORT and DEVELOPMENT as floating roles.
export function isFloatingSelectionRole(role: SelectionRole): boolean {
  return (
    role === "SUPPORT" ||
    role === "DEVELOPMENT" ||
    role === "BACKFILL" ||
    role === "CONFIDENCE_REBUILD" ||
    role === "CORE_MATCH_DROP" ||
    role === "REDUCED_MATCH_LOAD_DROP"
  );
}