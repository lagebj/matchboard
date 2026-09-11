/**
 * Players overview presentation view model (Touchline Design Atlas,
 * `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §A`).
 *
 * Sources:
 * - seasonRows   -> EXISTING_DIRECT (getPlayersSeasonOverview().seasonRows, src/lib/players/get-players-overview.ts)
 * - attentionRows -> EXISTING_DIRECT (getPlayersCurrentRoundAttention(), same module)
 * Derived:
 * - selectedInspector -> DERIVED_PRESENTATION (join of the selected player's season row + attention row, presentation-only)
 *
 * Per `07§A`: overall rating may never be the primary ranking/sort column. This module does not
 * sort by rating and the roster row shape below has no rating field at all.
 */

export interface PlayerRosterRow {
  playerId: string;
  displayName: string;
  coreTeamName: string | null;
  primaryPosition: string | null;
  availability: string;
  actualAppearances: number;
  coreAppearances: number;
  supportAppearances: number;
  developmentAppearances: number;
  attention: string | null; // e.g. integrityState label, only when not "COVERED"
}

export interface PlayerInspectorViewModel {
  playerId: string;
  displayName: string;
  coreTeamName: string | null;
  primaryPosition: string | null;
  seasonAppearances: number;
  seasonGoals: number;
  seasonAssists: number;
  positionExposure: { code: string; share: number }[];
  availability: string;
  developmentFocus: string | null;
}

export interface PlayerListViewModelInput {
  roster: PlayerRosterRow[];
  selectedPlayerId: string | null;
  inspector: PlayerInspectorViewModel | null;
}

export interface PlayerListViewModel {
  roster: PlayerRosterRow[];
  selectedPlayerId: string | null;
  inspector: PlayerInspectorViewModel | null;
}

export function buildPlayerListViewModel(input: PlayerListViewModelInput): PlayerListViewModel {
  return {
    roster: input.roster,
    selectedPlayerId: input.selectedPlayerId,
    inspector: input.inspector,
  };
}
