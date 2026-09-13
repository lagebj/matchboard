/**
 * Players "Development" mode (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §6`) — a
 * coaching-work overview across the whole roster. Never a ranking (contract's own rule) — no
 * sort/score field is exposed here beyond the player's own name.
 */
export type PlayersDevelopmentRow = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  activeDevelopmentFocus: string | null;
  focusStartedAt: string | null;
  latestObservationSummary: string | null;
  effectivePositionSummary: string | null;
  decisionReviewState: "PENDING" | "SUPERSEDED" | "COMPLETED" | null;
};

export type PlayersDevelopmentViewModelInput = {
  rows: PlayersDevelopmentRow[];
};

export type PlayersDevelopmentViewModel = PlayersDevelopmentViewModelInput;

export function buildPlayersDevelopmentViewModel(input: PlayersDevelopmentViewModelInput): PlayersDevelopmentViewModel {
  return input;
}
