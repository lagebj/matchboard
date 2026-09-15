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

/**
 * A narrow, client-safe projection of a canonical `PlanIntegritySignal`
 * (`src/lib/selection/compute-plan-integrity.ts`) — League Operating Surface
 * (`03_DATA_CONTRACT_AND_VIEW_MODEL.md`). Carries the minimum detail needed to explain a
 * concrete round/match problem without re-running or duplicating the plan-integrity engine.
 */
export type FixturePlanningSignal = {
  idempotencyKey: string;
  kind: "BLOCKED" | "DECISION_REQUIRED";
  ruleCode:
    | "SQUAD_BELOW_MINIMUM"
    | "SELECTED_PLAYER_UNAVAILABLE"
    | "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE"
    | "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY";
  title: string;
  currentState: string;
  consequence: string;
  primaryActionLabel: string;
  primaryActionTarget: string;
  matchId?: string;
  teamId?: string;
  playerId?: string;
};

export interface FixturesOverview {
  periods: FixturePeriod[];
}

export interface FixturePeriod {
  id: string;
  title: string;
  dateRange?: string;
  /** ISO instants for the league season's real phase boundaries (`LeagueSeason.startDate`/
   * `endDate`) — used to build the season rail's week slots. */
  startDate: string;
  endDate: string;
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
  /** Round-level plan-integrity signals with no truthful match/team owner (03§"Mapping round
   * signals to a focused match row"). Never attached to a match/team it doesn't belong to. */
  roundLevelPlanningSignals: FixturePlanningSignal[];
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
  /** The existing configured `Team.kitColor` value for this match's own team — resolved through
   * `resolveKitColorSwatch()` at presentation time, never a second colour model (05§"Data flow"). */
  teamKitColor: string | null;
  /** Tactical preparation state — `MatchLineup` exists with a non-null `formationId`
   * (03§"Tactics/lineup preparation definition"). No new tactics persistence. */
  lineupState: "MISSING" | "PREPARED";
  /** Match-owned or team-owned plan-integrity signals only — see the ownership rules in
   * `03_DATA_CONTRACT_AND_VIEW_MODEL.md`. */
  planningSignals: FixturePlanningSignal[];
}