/**
 * Season overview presentation view model (Touchline Design Atlas,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §E`).
 *
 * Sources:
 * - identity        -> EXISTING_DIRECT (LeagueSeason: name, startDate, endDate, status)
 * - roundCount/finalizedRoundCount/draftRoundCount -> EXISTING_DIRECT (getSeasonPlayerRoundMatrix())
 * - recentMatches / upcomingMatches -> EXISTING_DIRECT (MatchPresentation[], own-team perspective)
 * - activeFocus      -> CONDITIONAL (TeamFocus, only when present for a team in scope)
 * - evidenceSpotlight -> EXISTING_QUERYABLE (one existing evidence family, caller-selected)
 * Derived:
 * - progressPercent  -> DERIVED_PRESENTATION (finalizedRoundCount / roundCount, clamped)
 * - participationCoveragePercent -> DERIVED_PRESENTATION (players with >=1 finalized appearance / total core players)
 */

export interface SeasonViewModelInput {
  leagueSeasonId: string;
  displayLabel: string;
  status: "OPEN" | "FINALIZED";
  roundCount: number;
  finalizedRoundCount: number;
  playersWithAppearance: number;
  totalCorePlayers: number;
}

export interface SeasonViewModel extends SeasonViewModelInput {
  progressPercent: number;
  participationCoveragePercent: number;
}

export function buildSeasonViewModel(input: SeasonViewModelInput): SeasonViewModel {
  const progressPercent =
    input.roundCount > 0 ? Math.round((input.finalizedRoundCount / input.roundCount) * 100) : 0;
  const participationCoveragePercent =
    input.totalCorePlayers > 0 ? Math.round((input.playersWithAppearance / input.totalCorePlayers) * 100) : 0;

  return { ...input, progressPercent, participationCoveragePercent };
}
