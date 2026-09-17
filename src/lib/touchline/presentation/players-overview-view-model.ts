import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { PlayerRosterState } from "@/lib/players/roster-state";

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
  /** Normalized effective-primary position code (e.g. `DM`, `DEFENDER`) — filtering authority. */
  currentPrimaryPositionCode: string | null;
  /** Human-readable compact label for the same code — table/inspector display authority. */
  currentPrimaryPosition: string | null;
  availabilityLabel: string;
  /** Only ever non-null for an ACTIVE roster player — current-round opportunity semantics don't
      apply to an inactive/removed player (roster-state-and-mobile-convergence pass §7). */
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
  /** Roster state — distinct from football availability. Resolved once in the production
      adapter/input from `active`/`removedAt`; never re-derived by a consuming component (roster
      filter, mobile row presentation, selected-player inspector, accessibility text all reuse
      this field). See `src/lib/players/roster-state.ts`. */
  rosterState: PlayerRosterState;
};

export type PlayersOverviewInspectorData = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  coreTeamName: string | null;
  currentPrimaryPosition: string | null;
  /** Full human-readable label (e.g. "Winger") for the same position — the inspector identity
      line pairs this with the compact code (e.g. "Winger (W)"), while the dense roster table
      keeps using the compact form alone. Same value as `currentPrimaryPosition` when the compact
      and full labels coincide (e.g. broad `Defender`), so the identity line never repeats itself. */
  currentPrimaryPositionFull: string | null;
  availabilityLabel: string;
  /** Roster state — see `PlayersOverviewRow.rosterState`. */
  rosterState: PlayerRosterState;
  /** Current-round opportunity summary, `null` for an Inactive/Removed player — the inspector
      must omit the Current-round opportunity row entirely rather than render a manufactured
      "no opportunity" state for a player outside the active roster (roster-state-and-mobile-
      convergence pass §7). */
  opportunityLabel: string | null;
  effectivePositions: TouchlinePositionMapEntry[];
  played: number;
  goals: number;
  assists: number;
  core: number;
  support: number;
  development: number;
  activeDevelopmentFocus: string | null;
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
