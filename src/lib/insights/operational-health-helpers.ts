import type { OperationalHealthGroup } from "./insights-types";

export const FINALISATION_CHECKPOINT_WINDOW_DAYS = 7;

export const OPERATIONAL_HEALTH_LABELS: Record<OperationalHealthGroup["category"], string> = {
  incomplete_lineups: "Incomplete lineups",
  stale_assignments: "Stale assignments",
  missing_reports: "Missing reports",
  unresolved_reviews: "Unresolved reviews",
  unowned_upcoming_work: "Unowned upcoming work",
  expiring_support_access: "Expiring support access",
  availability_conflicts: "Availability conflicts",
  invalid_rotation_paths: "Invalid rotation paths",
  finalisation_checkpoints: "Finalisation checkpoints",
};

export function totalOperationalHealthCount(groups: OperationalHealthGroup[]): number {
  return groups.reduce((sum, g) => sum + g.count, 0);
}
