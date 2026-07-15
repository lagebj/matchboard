import type { OpportunityCellStatus } from "./insights-types";

export function mapPlannedRoleToStatus(role: string): OpportunityCellStatus {
  switch (role) {
    case "CORE":
      return "planned_core";
    case "SUPPORT":
    case "BACKFILL":
      return "planned_support";
    case "DEVELOPMENT":
    case "CONFIDENCE_REBUILD":
      return "planned_development";
    case "CORE_MATCH_DROP":
    case "REDUCED_MATCH_LOAD_DROP":
    case "MANUAL_OVERRIDE":
      return "planned_squad_repair";
    default:
      return "planned_core";
  }
}

export function mapPlannedRoleToActualStatus(role: string): OpportunityCellStatus {
  switch (role) {
    case "CORE":
    case "CORE_MATCH_DROP":
      return "actual_core";
    case "SUPPORT":
    case "BACKFILL":
      return "actual_support";
    case "DEVELOPMENT":
    case "CONFIDENCE_REBUILD":
      return "actual_development";
    default:
      return "actual_core";
  }
}