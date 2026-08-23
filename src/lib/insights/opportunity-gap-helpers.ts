import type { OpportunityGapRow } from "./insights-types";

// Descriptive only — explicitly not a debt score. Higher gap sorts first purely so the coach
// can scan for the largest planned-vs-realised differences; this is a display convenience, not
// a ranking or obligation.
export function sortByGapDescending(rows: OpportunityGapRow[]): OpportunityGapRow[] {
  return [...rows].sort((a, b) => b.gap - a.gap);
}

export function hasAnyGap(row: OpportunityGapRow): boolean {
  return row.gap > 0;
}
