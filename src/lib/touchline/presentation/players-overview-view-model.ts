import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

/**
 * Players Overview — the dense roster/workspace mode (Atlas Follow-up,
 * `03_PLAYER_OVERVIEW_CONTRACT.md §3`). Distinct from `player-overview-view-model.ts` (singular
 * — one player's own Detail-page Overview tab, Phase F4).
 *
 * Column set mirrors the real, already-existing `getPlayersSeasonOverview()`
 * (`src/lib/players/get-players-overview.ts`) shape — Played/Goals/Assists/Core/Support/
 * Development/Matchday-additions/Planned-absent are all real canonical fields already computed
 * there, not invented for this bundle. This view model does not re-derive them; a production
 * caller (Phase F8) maps that existing result onto this shape.
 */
export type PlayersOverviewRow = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  coreTeamName: string | null;
  currentPrimaryPosition: string | null;
  availabilityLabel: string;
  hasOpportunityThisWeek: boolean | null;
  played: number;
  goals: number;
  assists: number;
  core: number;
  support: number;
  development: number;
  matchdayAdditions: number;
  plannedButAbsent: number;
  attention: boolean;
};

export type PlayersOverviewInspectorData = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  currentPrimaryPosition: string | null;
  availabilityLabel: string;
  opportunityLabel: string;
  effectivePositions: TouchlinePositionMapEntry[];
  activeDevelopmentFocus: string | null;
  latestObservationNote: string | null;
  playerDetailHref: string;
};

export type PlayersOverviewViewModelInput = {
  leagueSeasonLabel: string;
  rows: PlayersOverviewRow[];
};

export type PlayersOverviewViewModel = PlayersOverviewViewModelInput;

export function buildPlayersOverviewViewModel(input: PlayersOverviewViewModelInput): PlayersOverviewViewModel {
  return input;
}
