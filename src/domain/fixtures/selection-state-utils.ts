import type { SelectionAction, SelectionState } from "./types";

export function getRoundActions(state: SelectionState, hasMatches: boolean): SelectionAction[] {
  if (!hasMatches) return [];
  switch (state) {
    case "NOT_GENERATED":
      return ["createDraft"];
    case "DRAFT":
      return ["recreateDraft", "clearDraft", "finalize"];
    case "BLOCKED":
      return ["recreateDraft", "clearDraft", "finalize"];
    case "READY":
      return ["recreateDraft", "clearDraft", "finalize"];
    case "FINALIZED":
      return ["unfinalize"];
  }
}

export function getMatchActions(roundState: SelectionState, matchHasDraftSelections: boolean, _roundHasDraftSelections: boolean): SelectionAction[] {
  if (roundState === "FINALIZED") return [];
  switch (roundState) {
    case "NOT_GENERATED":
      return ["createDraft"];
    case "DRAFT":
    case "BLOCKED":
    case "READY":
      if (matchHasDraftSelections) {
        return ["recreateDraft", "clearDraft", "finalize"];
      }
      return ["createDraft"];
    default:
      return [];
  }
}

export function deriveMatchSelectionState(
  roundState: SelectionState,
  matchHasDraftSelections: boolean,
  matchHasFinalizedSelections: boolean,
): SelectionState {
  if (roundState === "FINALIZED") return "FINALIZED";
  if (matchHasFinalizedSelections) return "FINALIZED";
  if (matchHasDraftSelections) return "DRAFT";
  return "NOT_GENERATED";
}