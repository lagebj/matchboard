import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

export type SelectionState = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";

export type SelectionAction = "createDraft" | "recreateDraft" | "clearDraft" | "finalize" | "unfinalize";

export type FixtureRoundIntegritySummary = {
  blockerCount: number;
  decisionRequiredCount: number;
  belowMinimumMatchCount: number;
  unavailableSelectedPlayerCount: number;
  missingOpportunityPlayerCount: number;
  integrityFailureCount: number;
};

export type CompletedFixtureResult = {
  goalsFor: number;
  goalsAgainst: number;
  outcome: "WON" | "DRAWN" | "LOST";
  displayScore: string;
};

export type FixtureReportState =
  | { state: "NO_REPORT" }
  | { state: "DRAFT_REPORT_INCOMPLETE"; reportId: string }
  | { state: "COMPLETED"; result: CompletedFixtureResult };

export interface FixturesOverview {
  periods: FixturePeriod[];
}

export interface FixturePeriod {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  blockerCount: number;
  decisionRequiredCount: number;
  rounds: FixtureRound[];
  /** True when today's date falls within this league season's date range. At most one period
   * should have this true; the client should default its selection to it when present. */
  isCurrent: boolean;
}

export interface FixtureRound {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  selectionState: SelectionState;
  hasDraftSelections: boolean;
  hasMatches: boolean;
  blockerCount: number;
  decisionRequiredCount: number;
  availableActions: SelectionAction[];
  matches: FixtureMatch[];
}

export interface FixtureMatch {
  id: string;
  title: string;
  teamId: string;
  teamName: string;
  opponent?: string;
  opponentTeamId?: string | null;
  startsAt?: string;
  venue?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  selectionState: SelectionState;
  selectedPlayerCount?: number;
  blockerCount: number;
  decisionRequiredCount: number;
  postMatchStatus?: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED";
  reportState: FixtureReportState;
  availableActions: SelectionAction[];
  matchStatus: "SCHEDULED" | "CANCELLED";
  cancelledReason?: string | null;
  /** The primary, football-action-oriented match status (ADR-0101). Supersedes selectionState/
   * postMatchStatus as the label shown to the coach for this single match; those remain
   * available above for round-level aggregation and internal logic. */
  lifecycleStatus: MatchLifecycleStatus;
}