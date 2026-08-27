export type IntegritySeverity = "ERROR" | "REVIEW" | "INFO";

export type IntegrityDomain =
  | "PLAYER_GOALS"
  | "PLAYER_ASSISTS"
  | "ACTUAL_APPEARANCES"
  | "PLANNED_ABSENCES"
  | "MATCH_SCORE_GOAL_EVENTS"
  | "SUPPORT_REQUIREMENT_CONFIG"
  | "OPPONENT_IDENTITY"
  | "MOVEMENT_LEDGER"
  | "SELECTION_EXPLANATION"
  | "AVAILABILITY_PRECEDENCE"
  | "SUPPORT_NO_SHOW_COUNTER"
  | "PLANNED_DOUBLE_LOAD_LEGACY"
  | "PLAN_INTEGRITY_PROJECTION"
  | "COMBINATION_EVIDENCE_PROJECTION";

export type Repairability = "AUTO_SAFE" | "REQUIRES_FACTUAL_REVIEW" | "REPORT_ONLY";

export type IntegrityFinding = {
  code: string;
  severity: IntegritySeverity;
  domain: IntegrityDomain;
  entityType: string;
  entityId: string;
  matchId?: string;
  playerId?: string;
  leagueSeasonId?: string;
  message: string;
  canonicalValue?: unknown;
  conflictingValue?: unknown;
  repairability: Repairability;
  recommendedAction: string;
};

export type IntegrityAuditResult = {
  executedAt: Date;
  scope: {
    leagueSeasonId?: string;
    matchId?: string;
  };
  countsByDomain: Partial<Record<IntegrityDomain, number>>;
  countsBySeverity: Partial<Record<IntegritySeverity, number>>;
  findings: IntegrityFinding[];
};

export type IntegrityAuditInput = {
  leagueSeasonId?: string;
  matchId?: string;
};

export type ReconcileInput = {
  dryRun: boolean;
  leagueSeasonId?: string;
  matchId?: string;
  domains: Array<"PLAYER_GOALS_DERIVED_PROJECTION" | "PLAYER_ASSISTS_DERIVED_PROJECTION" | "OPPONENT_SNAPSHOT_DERIVED_PROJECTION" | "ACTIVE_PLAN_INTEGRITY_PROJECTION" | "COMBINATION_EVIDENCE_DERIVED_PROJECTION">;
};

export type ReconcileResult = {
  dryRun: boolean;
  inspected: number;
  proposedChanges: number;
  appliedChanges: number;
  skippedRequiresFactualReview: number;
  findings: IntegrityFinding[];
};