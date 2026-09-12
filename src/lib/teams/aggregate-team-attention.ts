/**
 * Teams overview (Touchline Design Atlas, ADR-0136 Phase 6,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §C`): "unresolved planning attention" per team
 * -- the view model's own doc comment defines this as "count of active TeamFocus + open
 * plan-integrity signals for the team's most recent round." Pure, DB-free -- the route resolves
 * each team's most recent round, calls the canonical `computeRoundPlanIntegrity()` once per
 * *distinct* round (never once per team), and passes the flattened signals + active-focus rows
 * in here to count per team.
 *
 * `RoundPlanIntegrity.signals` already contains only BLOCKED/DECISION_REQUIRED entries (Planning
 * notes are a separate array) -- every signal counts, no category filter needed here.
 */
export interface TeamAttentionSignalInput {
  teamId?: string | null;
}

export interface ActiveTeamFocusInput {
  teamId: string;
}

export function countUnresolvedPlanningAttention(
  teamIds: string[],
  signals: TeamAttentionSignalInput[],
  activeFocuses: ActiveTeamFocusInput[],
): Map<string, number> {
  const counts = new Map<string, number>(teamIds.map((id) => [id, 0]));

  for (const signal of signals) {
    if (signal.teamId && counts.has(signal.teamId)) {
      counts.set(signal.teamId, counts.get(signal.teamId)! + 1);
    }
  }

  for (const focus of activeFocuses) {
    if (counts.has(focus.teamId)) {
      counts.set(focus.teamId, counts.get(focus.teamId)! + 1);
    }
  }

  return counts;
}
