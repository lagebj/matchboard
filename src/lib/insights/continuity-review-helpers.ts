import type { ContinuityRow } from "./insights-types";

export function continuityRatio(row: ContinuityRow): number | null {
  const total = row.retainedStarterCount + row.newPlayerCount;
  if (total === 0) return null;
  return row.retainedStarterCount / total;
}

export function formatFormationChange(row: ContinuityRow): string {
  if (row.retainedFormation === null) return "No prior formation data";
  return row.retainedFormation ? "Repeated formation" : "Changed formation";
}
