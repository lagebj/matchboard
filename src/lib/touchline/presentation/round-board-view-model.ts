/**
 * Round Board presentation view model (Touchline Design Atlas,
 * `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §A`).
 *
 * The Round Board stays a dense professional workbench — this module only assembles the one
 * approved compact summary strip (`03_CODE_CHANGE_MAP.md` / prior Touchline Finish pass), it does
 * not touch the drag/drop/move mutation model at all.
 *
 * Sources:
 * - columns      -> EXISTING_DIRECT (per-match roster columns, existing Round Board data)
 * - planIntegrity -> EXISTING_DIRECT (RoundPlanIntegrity.summary)
 * Derived:
 * - summaryItems  -> DERIVED_PRESENTATION (blocked/decision-required counts formatted for WorkbenchSummaryStrip)
 */

export interface RoundBoardColumnInput {
  matchId: string;
  title: string;
  playerCount: number;
}

export interface RoundBoardViewModelInput {
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

export interface RoundBoardViewModel {
  roundLabel: string;
  columns: RoundBoardColumnInput[];
  summaryItems: RoundBoardSummaryItem[];
}

export function buildRoundBoardViewModel(input: RoundBoardViewModelInput): RoundBoardViewModel {
  const summaryItems: RoundBoardSummaryItem[] = [
    { id: "matches", label: "Matches", value: String(input.columns.length), tone: "neutral" },
    {
      id: "blocked",
      label: input.blockerCount === 1 ? "Blocked" : "Blocked",
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
