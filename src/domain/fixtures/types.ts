export type SelectionState = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";

export type SelectionAction = "createDraft" | "recreateDraft" | "clearDraft" | "finalize" | "unfinalize";

export interface FixturesOverview {
  periods: FixturePeriod[];
}

export interface FixturePeriod {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  unresolvedIssueCount: number;
  rounds: FixtureRound[];
}

export interface FixtureRound {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  selectionState: SelectionState;
  hasDraftSelections: boolean;
  hasMatches: boolean;
  unresolvedIssueCount: number;
  availableActions: SelectionAction[];
  matches: FixtureMatch[];
}

export interface FixtureMatch {
  id: string;
  title: string;
  teamId: string;
  teamName: string;
  opponent?: string;
  startsAt?: string;
  venue?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  selectionState: SelectionState;
  selectedPlayerCount?: number;
  unresolvedIssueCount: number;
  postMatchStatus?: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED";
  availableActions: SelectionAction[];
}