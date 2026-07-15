type InsightSeverity = "blocked" | "decision_required" | "planning_note";

export function classifyWarningSeverity(
  dbSeverity: string,
  rule: string,
): InsightSeverity {
  const hardBlockRules = [
    "player_in_multiple_matches",
    "duplicate_player_in_match",
    "invariant_invalid_non_core_selection",
    "squad_below_minimum",
    "selected_player_unavailable",
    "duplicate_planned_assignment_integrity_failure",
  ];
  if (hardBlockRules.includes(rule)) return "blocked";

  const requiresOverrideRules = [
    "support_requirement_shortfall",
    "squad_repair_shortfall_after_resolution",
    "repair_requires_override",
    "repair_below_minimum",
    "available_player_without_planned_opportunity",
  ];
  if (requiresOverrideRules.includes(rule)) return "decision_required";

  if (dbSeverity === "HARD_BLOCK") return "blocked";
  if (dbSeverity === "REQUIRES_OVERRIDE") return "decision_required";
  if (dbSeverity === "WARNING") return "planning_note";
  if (dbSeverity === "SCORING_PREFERENCE") return "planning_note";

  return "planning_note";
}

export function getSeverityLabel(severity: InsightSeverity): string {
  switch (severity) {
    case "blocked":
      return "Blocked";
    case "decision_required":
      return "Decision required";
    case "planning_note":
      return "Planning note";
  }
}

export function getSeverityStyle(severity: InsightSeverity): string {
  switch (severity) {
    case "blocked":
      return "bg-red-900/30 text-red-300 border-red-700/30";
    case "decision_required":
      return "bg-amber-900/25 text-amber-300 border-amber-700/30";
    case "planning_note":
      return "bg-zinc-800/30 text-zinc-400 border-zinc-600/30";
  }
}