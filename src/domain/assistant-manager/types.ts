export type AssistantIssueEntityType =
  | "ROUND"
  | "TEAM"
  | "MATCH"
  | "PLAYER"
  | "AVAILABILITY"
  | "SELECTION"
  | "POST_MATCH";

import type { SignalCategory } from "@/lib/selection/signal-category";

export type { SignalCategory };

export type BlockerType = "NONE" | "SOFT" | "HARD";

export type RecommendationConfidence = "LOW" | "MEDIUM" | "HIGH";

export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";

export type ReadinessState = "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";

export type DecisionAction =
  | "ACCEPT_RECOMMENDATION"
  | "REJECT_RECOMMENDATION"
  | "OVERRIDE_BLOCKER"
  | "APPROVE_DRAFT"
  | "REJECT_DRAFT"
  | "FINALIZE"
  | "MARK_STALE"
  | "DISMISS"
  | "MARK_MATCH_COMPLETE"
  | "MOVE_PLAYER_TO_TEAM"
  | "UPDATE_TEAM_CONFIGURATION";

export type DecisionType =
  | "ASSISTANT_ISSUE"
  | "ROUND_REVIEW"
  | "TEAM_REVIEW"
  | "MATCH_REVIEW"
  | "PLAYER_EXCEPTION"
  | "POST_MATCH"
  | "PLAYER_ASSIGNMENT"
  | "TEAM_CONFIGURATION";

export type AttendanceStatus =
  | "PRESENT"
  | "NO_SHOW"
  | "LATE_CANCELLATION"
  | "ABSENT_CONFIRMED"
  | "UNKNOWN";

export interface RuleImpact {
  ruleId: string;
  ruleName: string;
  effect: string;
  signalCategory: SignalCategory;
  affectedPlayerIds: string[];
  affectedTeamIds: string[];
  blockerType: BlockerType;
  explanation: string;
}

export interface CrossTeamImpact {
  sourceTeamId: string;
  targetTeamId: string;
  playerId: string;
  positiveEffects: string[];
  negativeEffects: string[];
  ruleConflicts: string[];
  fairnessImpact: string;
  loadImpact: string;
  summary: string;
  impactLevel: ImpactLevel;
}

export interface Recommendation {
  id: string;
  summary: string;
  confidence: RecommendationConfidence;
  suggestedActions: string[];
  rulesApplied: RuleImpact[];
  signals: string[];
  blockers: string[];
  crossTeamImpacts: CrossTeamImpact[];
}

export interface SelectionExplanation {
  id: string;
  scopeType: "ROUND" | "TEAM" | "MATCH" | "PLAYER";
  scopeId: string;
  matchId?: string;
  teamId?: string;
  playerId?: string;
  summary: string;
  rulesApplied: RuleImpact[];
  blockers: string[];
  signals: string[];
  recommendations: Recommendation[];
  crossTeamImpacts: CrossTeamImpact[];
  createdAt: string;
}

export interface DecisionRecord {
  id: string;
  decisionType: DecisionType;
  entityType: AssistantIssueEntityType;
  entityId: string;
  recommendationId?: string;
  action: DecisionAction;
  reason?: string;
  createdBy: string;
  createdAt: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
}

export interface TeamReadiness {
  teamId: string;
  teamName: string;
  roundId?: string;
  matchId?: string;
  readinessState: ReadinessState;
  confirmedPlayers: number;
  unknownRsvp: number;
  unavailablePlayers: number;
  blockedPlayers: number;
  targetSquadSize: number;
  maxSquadSize: number;
  supportNeeded: number;
  positionGaps: string[];
  rotationPressure: "LOW" | "MEDIUM" | "HIGH";
  signals: string[];
  ruleImpacts: RuleImpact[];
  recommendation?: Recommendation;
}

export interface MatchReview {
  matchId: string;
  teamId: string;
  teamName?: string;
  roundId?: string;
  readinessState: ReadinessState;
  selectedPlayerIds: string[];
  unavailablePlayerIds: string[];
  unknownRsvpPlayerIds: string[];
  eligibleNotSelectedPlayerIds: string[];
  blockedPlayerIds: string[];
  positionGaps: string[];
  ruleImpacts: RuleImpact[];
  recommendations: Recommendation[];
  crossTeamImpacts: CrossTeamImpact[];
  approved: boolean;
  published: boolean;
}

export interface RoundReview {
  roundId: string;
  title: string;
  readinessState: ReadinessState;
  teamReadiness: TeamReadiness[];
  matchReviews: MatchReview[];
  openIssueIds: string[];
  blockedConditionCount: number;
  decisionRequiredCount: number;
  finalizeable: boolean;
}

export interface PostMatchPlayerActual {
  playerId: string;
  attendanceStatus: AttendanceStatus;
  unplannedAppearanceReason?: string;
  actualPositions?: string[];
  note?: string;
}

export interface PostMatchReport {
  matchId: string;
  status: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED";
  teamNote?: string;
  playerActuals: PostMatchPlayerActual[];
  completedBy?: string;
  completedAt?: string;
}