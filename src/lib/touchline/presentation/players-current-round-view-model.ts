/**
 * Players "Current round" mode (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §5`) — reuses
 * the same canonical opportunity/attention state `computeRoundPlanIntegrity()` and Round Board
 * already produce (`IntegrityAttentionState` in `src/lib/players/get-players-overview.ts`), never
 * a second "missing opportunity" rule.
 */
export type PlayersCurrentRoundAttentionState =
  | "COVERED"
  | "DECISION_REQUIRED_NO_PLANNED_MATCH"
  | "BLOCKED_UNAVAILABLE_SELECTION"
  | "BLOCKED_INVALID_PLAN"
  | "NOT_AVAILABLE"
  | "UNCONFIRMED";

export type PlayersCurrentRoundRow = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  coreTeamName: string | null;
  availabilityLabel: string;
  currentAssignment: { teamName: string; opponent: string; role: "CORE" | "SUPPORT" | "DEVELOPMENT" } | null;
  attentionState: PlayersCurrentRoundAttentionState;
};

const ATTENTION_ORDER: Record<PlayersCurrentRoundAttentionState, number> = {
  BLOCKED_UNAVAILABLE_SELECTION: 0,
  BLOCKED_INVALID_PLAN: 1,
  DECISION_REQUIRED_NO_PLANNED_MATCH: 2,
  UNCONFIRMED: 3,
  COVERED: 4,
  NOT_AVAILABLE: 5,
};

export type PlayersCurrentRoundViewModelInput = {
  roundLabel: string;
  rows: PlayersCurrentRoundRow[];
};

export type PlayersCurrentRoundViewModel = PlayersCurrentRoundViewModelInput & {
  /** Blocked/decision-required first, matching contract §"Current round attention default sort". */
  sortedRows: PlayersCurrentRoundRow[];
};

export function buildPlayersCurrentRoundViewModel(input: PlayersCurrentRoundViewModelInput): PlayersCurrentRoundViewModel {
  const sortedRows = [...input.rows].sort(
    (a, b) => ATTENTION_ORDER[a.attentionState] - ATTENTION_ORDER[b.attentionState] || a.displayName.localeCompare(b.displayName),
  );
  return { ...input, sortedRows };
}
