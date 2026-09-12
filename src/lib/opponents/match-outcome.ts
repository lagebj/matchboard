/**
 * Shared match-outcome computation, extracted from `getOpponentHistory()`
 * (`src/lib/audit/opponent-history.ts`) so it can be reused without that function's
 * `footballGroupId` scoping (Touchline Design Atlas, ADR-0136 Phase 6,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §A/§B`). Pure, DB-free — takes already-loaded
 * home/away goals and which side is "ours".
 */
export function computeMatchOutcome(
  homeAway: string,
  homeGoals: number | null,
  awayGoals: number | null,
): "won" | "drawn" | "lost" | null {
  if (homeGoals === null || awayGoals === null) return null;
  const isHome = homeAway === "HOME";
  if (homeGoals > awayGoals) return isHome ? "won" : "lost";
  if (homeGoals < awayGoals) return isHome ? "lost" : "won";
  return "drawn";
}
