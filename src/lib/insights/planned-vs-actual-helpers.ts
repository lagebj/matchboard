import type { PlannedActualDeltaType } from "./insights-types";

export function classifyDeltaType(source: string): PlannedActualDeltaType {
  switch (source) {
    case "UNPLANNED":
      return "unplanned_participant";
    default:
      return "unplanned_participant";
  }
}

export function getDeltaTypeLabel(deltaType: PlannedActualDeltaType): string {
  switch (deltaType) {
    case "planned_absent":
      return "Planned but absent";
    case "planned_substitute_started":
      return "Planned substitute started";
    case "unplanned_participant":
      return "Unplanned participant";
    case "planned_helper_unused":
      return "Planned helper not used";
    case "helper_added_after_plan":
      return "Helper added after plan";
    case "lineup_changed_after_matchday":
      return "Lineup changed after matchday";
    case "report_missing":
      return "Report missing";
    case "actual_participation_missing":
      return "Actual participation missing";
  }
}

export function getDeltaTypeStyle(deltaType: PlannedActualDeltaType): string {
  switch (deltaType) {
    case "planned_absent":
      return "bg-red-900/30 text-red-300";
    case "planned_substitute_started":
      return "bg-amber-900/25 text-amber-300";
    case "unplanned_participant":
      return "bg-cyan-900/25 text-cyan-300";
    case "planned_helper_unused":
      return "bg-orange-900/25 text-orange-300";
    case "helper_added_after_plan":
      return "bg-blue-900/25 text-blue-300";
    case "lineup_changed_after_matchday":
      return "bg-purple-900/25 text-purple-300";
    case "report_missing":
      return "bg-yellow-900/25 text-yellow-300";
    case "actual_participation_missing":
      return "bg-zinc-800/30 text-zinc-400";
  }
}