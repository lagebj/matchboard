/**
 * Player Detail's Development tab (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §6`) — "What
 * are we trying to help this player learn?" Never a numeric ranking (contract's own rule).
 *
 * `reviewState`/`reviewDueAt` mirror the existing Decision Review vocabulary (ADR-0132:
 * PENDING/SUPERSEDED/COMPLETED, Keep/Change/Complete/Later resolutions) — this tab surfaces that
 * existing state, it does not invent a second review concept.
 */
export type PlayerDevelopmentObservationEntry = {
  id: string;
  note: string;
  createdAt: string;
  matchLabel: string | null;
};

export type PlayerCompletedFocusEntry = {
  id: string;
  focus: string;
  category: string | null;
  startedAt: string;
  completedAt: string;
};

export type PlayerDevelopmentViewModelInput = {
  activeFocus: {
    id: string;
    focus: string;
    category: string | null;
    rationale: string | null;
    startedAt: string;
    reviewState: "PENDING" | "SUPERSEDED" | "COMPLETED" | null;
    reviewDueAt: string | null;
    observationCount: number;
  } | null;
  observationTimeline: PlayerDevelopmentObservationEntry[];
  /** Short, factual notes connecting development focus to positional exposure — never a score. */
  positionalContextNotes: string[];
  completedFocusHistory: PlayerCompletedFocusEntry[];
};

export type PlayerDevelopmentViewModel = PlayerDevelopmentViewModelInput;

export function buildPlayerDevelopmentViewModel(input: PlayerDevelopmentViewModelInput): PlayerDevelopmentViewModel {
  return input;
}
