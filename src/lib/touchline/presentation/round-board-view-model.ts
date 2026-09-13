/**
 * Round Board presentation view models.
 *
 * Two distinct models coexist here, deliberately:
 *
 * 1. `RoundBoardSummaryStripViewModel` (Touchline Design Atlas,
 *    `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §A`) — the original, narrower "compact summary
 *    strip" model built for the first Atlas UI-lab pass
 *    (`/dev/ui-lab/atlas/routes/round-board`). Explicitly scoped at the time as "does not touch
 *    the drag/drop/move mutation model at all" — a decorative summary only. Kept, renamed from
 *    its original bare `RoundBoard*` names (which the Atlas Follow-up bundle's own fuller model
 *    below needed), so that route keeps compiling unchanged.
 *
 * 2. `RoundBoardViewModel` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md`,
 *    `08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §3`) — the full decision-surface model this
 *    bundle's Phase F6 needs: status, summary, per-match lanes with players, and an attention
 *    list. The route receives these explicit, pre-resolved concepts — it does not compute
 *    plan-integrity/status itself (contract's own instruction: derive from the existing canonical
 *    `computeRoundPlanIntegrity()`, never re-derive in the UI layer).
 */

export interface RoundBoardColumnInput {
  matchId: string;
  title: string;
  playerCount: number;
}

export interface RoundBoardSummaryStripViewModelInput {
  roundLabel: string;
  columns: RoundBoardColumnInput[];
  blockerCount: number;
  decisionRequiredCount: number;
}

export interface RoundBoardSummaryItem {
  id: string;
  label: string;
  value: string;
  tone: "neutral" | "attention" | "danger";
}

export interface RoundBoardSummaryStripViewModel {
  roundLabel: string;
  columns: RoundBoardColumnInput[];
  summaryItems: RoundBoardSummaryItem[];
}

export function buildRoundBoardSummaryStripViewModel(input: RoundBoardSummaryStripViewModelInput): RoundBoardSummaryStripViewModel {
  const summaryItems: RoundBoardSummaryItem[] = [
    { id: "matches", label: "Matches", value: String(input.columns.length), tone: "neutral" },
    {
      id: "blocked",
      label: "Blocked",
      value: String(input.blockerCount),
      tone: input.blockerCount > 0 ? "danger" : "neutral",
    },
    {
      id: "decisions",
      label: "Decisions required",
      value: String(input.decisionRequiredCount),
      tone: input.decisionRequiredCount > 0 ? "attention" : "neutral",
    },
  ];

  return { roundLabel: input.roundLabel, columns: input.columns, summaryItems };
}

/* --- Atlas Follow-up full Round Board model (Phase F6) -------------------------------------- */

export type RoundStatus = "READY" | "NEEDS_DECISIONS" | "BLOCKED";
export type RoundPlayerRole = "CORE" | "SUPPORT" | "DEVELOPMENT";

export type RoundBoardPlayerRow = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  position: string | null;
  role: RoundPlayerRole;
  attention: boolean;
};

export type RoundBoardMatchLaneState = "NEEDS" | "COMPLETE";

export type RoundBoardMatchLane = {
  matchId: string;
  teamName: string;
  teamKitColor: string | null;
  opponent: string;
  kickoffLabel: string;
  squadCount: number;
  targetCount: number;
  laneState: RoundBoardMatchLaneState;
  laneStateDetail: string;
  players: RoundBoardPlayerRow[];
};

export type RoundBoardAttentionItem = {
  id: string;
  playerId: string | null;
  matchId: string | null;
  summary: string;
  detail: string;
  severity: "BLOCKED" | "DECISION_REQUIRED";
};

export type RoundBoardSummary = {
  decisions: number;
  matches: number;
  plannedOpportunities: number;
  targetOpportunities: number;
  coverageIssues: number;
};

export type RoundBoardViewModel = {
  status: RoundStatus;
  roundLabel: string;
  dateRangeLabel: string;
  summary: RoundBoardSummary;
  matches: RoundBoardMatchLane[];
  attention: RoundBoardAttentionItem[];
};

/**
 * A suggested destination for the currently-selected player — a separate, contextual view model
 * (contract §"Round Board view model": "Selected-player assignment suggestions are a separate
 * contextual view model. Do not infer these by scraping rendered lane data."). Reasons must come
 * from existing canonical planning logic, never an invented "AI reason" (contract §5).
 */
export type RoundBoardAssignmentSuggestion = {
  matchId: string;
  teamName: string;
  teamKitColor: string | null;
  resultingSquadCount: number;
  targetCount: number;
  reasons: string[];
  isRecommended: boolean;
};

export type RoundBoardPlayerAssignmentContext = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  positions: string[];
  attentionSummary: string | null;
  suggestions: RoundBoardAssignmentSuggestion[];
};
