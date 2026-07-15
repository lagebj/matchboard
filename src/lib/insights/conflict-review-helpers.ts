type ConflictSeverity = "blocked" | "decision_required" | "planning_note";
type ConflictType = "overlapping_selection" | "helper_overlap" | "player_double_planned" | "event_helper_conflict" | "missing_opponent" | "missing_report" | "future_report_incorrectly_unavailable";

export function classifyConflictSeverity(
  conflictType: ConflictType,
): ConflictSeverity {
  switch (conflictType) {
    case "player_double_planned":
    case "overlapping_selection":
      return "blocked";
    case "helper_overlap":
    case "event_helper_conflict":
      return "decision_required";
    case "missing_opponent":
    case "missing_report":
    case "future_report_incorrectly_unavailable":
      return "planning_note";
  }
}

export function getConflictTypeLabel(conflictType: ConflictType): string {
  switch (conflictType) {
    case "overlapping_selection":
      return "Overlapping selection";
    case "helper_overlap":
      return "Helper overlap";
    case "player_double_planned":
      return "Player double-planned";
    case "event_helper_conflict":
      return "Event helper conflict";
    case "missing_opponent":
      return "Missing opponent";
    case "missing_report":
      return "Missing report";
    case "future_report_incorrectly_unavailable":
      return "Future report incorrectly unavailable";
  }
}

export function getConflictTypeStyle(conflictType: ConflictType): string {
  const severity = classifyConflictSeverity(conflictType);
  switch (severity) {
    case "blocked":
      return "bg-red-900/30 text-red-300 border-red-700/30";
    case "decision_required":
      return "bg-amber-900/25 text-amber-300 border-amber-700/30";
    case "planning_note":
      return "bg-zinc-800/30 text-zinc-400 border-zinc-600/30";
  }
}