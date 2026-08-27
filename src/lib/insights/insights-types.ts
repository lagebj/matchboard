import type { SelectionRole } from "@/generated/prisma/client";

export type InsightScope =
  | "round"
  | "next_n_rounds"
  | "spring"
  | "fall"
  | "full_year"
  | "date_range"
  | "event";

export type InsightContext = "league" | "event" | "all";

export type InsightPlayerStatus = "active" | "removed" | "inactive";

export type OpportunityCellStatus =
  | "planned_core"
  | "planned_support"
  | "planned_development"
  | "planned_squad_repair"
  | "actual_core"
  | "actual_support"
  | "actual_development"
  | "actual_helper"
  | "actual_unplanned"
  | "missed_planned_opportunity"
  | "unavailable"
  | "not_selected"
  | "blocked"
  | "report_missing";

export type LoadCellStatus =
  | "league_match"
  | "event_match"
  | "helper_appearance"
  | "planned_only"
  | "actual_appearance"
  | "unavailable";

export type GoalkeeperCoverageLevel =
  | "primary"
  | "secondary"
  | "tertiary"
  | "emergency"
  | "none";

export type PolicyWarningSource =
  | "core_invariant"
  | "default_policy"
  | "custom_policy"
  | "solver_validation";

export type PlannedActualDeltaType =
  | "planned_absent"
  | "planned_substitute_started"
  | "unplanned_participant"
  | "planned_helper_unused"
  | "helper_added_after_plan"
  | "lineup_changed_after_matchday"
  | "report_missing"
  | "actual_participation_missing";

export type ConflictType =
  | "overlapping_selection"
  | "helper_overlap"
  | "player_double_planned"
  | "event_helper_conflict"
  | "missing_opponent"
  | "missing_report"
  | "future_report_incorrectly_unavailable";

export type InsightAttentionFlag =
  | "no_actual_opportunity"
  | "high_recent_load"
  | "planned_but_absent"
  | "report_missing"
  | "low_period_participation";

export interface InsightFilters {
  leagueSeasonId: string;
  scope: InsightScope;
  context: InsightContext;
  teamId?: string;
  eventId?: string;
  matchRoundId?: string;
  includeRemoved?: boolean;
  includeInactive?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface OpportunityMatrixRow {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  attentionFlags: InsightAttentionFlag[];
  cells: OpportunityMatrixCell[];
  totals: OpportunityMatrixTotals;
}

export interface OpportunityMatrixCell {
  matchRoundId: string;
  matchRoundLabel: string;
  matchId?: string;
  status: OpportunityCellStatus;
  teamName?: string;
  role?: string;
  explanation?: string;
}

export interface OpportunityMatrixTotals {
  plannedOpportunities: number;
  actualAppearances: number;
  missedPlannedOpportunities: number;
  helperAppearances: number;
  coreAppearances: number;
  supportAppearances: number;
  developmentAppearances: number;
}

export interface LoadTimelineRow {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  attentionFlags: InsightAttentionFlag[];
  cells: LoadTimelineCell[];
  recentLoad: number;
}

export interface LoadTimelineCell {
  matchRoundId: string;
  matchRoundLabel: string;
  status: LoadCellStatus;
  matchCount: number;
}

export interface CoverageMatrixEntry {
  squadId: string;
  squadName: string;
  teamId: string;
  teamName: string;
  matchId?: string;
  matchRoundId?: string;
  eventId?: string;
  intent?: string;
  goalkeeperCoverage: {
    primary: number;
    secondary: number;
    tertiary: number;
    emergency: number;
    total: number;
    none: boolean;
    tertiaryOnly: boolean;
  };
  positionCoverage: {
    defenders: number;
    midfielders: number;
    attackers: number;
    unassigned: number;
  };
  warnings: CoverageWarning[];
}

export type CoverageWarning =
  | "no_goalkeeper"
  | "no_primary_goalkeeper"
  | "tertiary_goalkeeper_only"
  | "insufficient_gk_coverage"
  | "no_defenders"
  | "no_midfielders"
  | "no_attackers"
  | "squad_below_minimum";

export interface PolicyWarningEntry {
  code: string;
  severity: "blocked" | "decision_required" | "planning_note";
  source: PolicyWarningSource;
  sourceLabel: string;
  message: string;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName?: string;
  matchId?: string;
  matchRoundId?: string;
  eventId?: string;
  policyPackId?: string | null;
  policyPackVersion?: string | null;
}

export interface PolicyWarningGroup {
  code: string;
  label: string;
  count: number;
  entries: PolicyWarningEntry[];
}

export interface PlannedActualDelta {
  matchId: string;
  matchRoundId: string;
  matchRoundLabel: string;
  teamId: string;
  teamName: string;
  eventId?: string;
  deltas: PlannedActualDeltaEntry[];
  reportStatus: "draft" | "reported" | "locked" | "missing";
}

export interface PlannedActualDeltaEntry {
  playerId: string;
  playerName: string;
  deltaType: PlannedActualDeltaType;
  plannedRole?: SelectionRole;
  actualRole?: SelectionRole;
  detail?: string;
}

export interface ConflictEntry {
  conflictType: ConflictType;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName?: string;
  matchId?: string;
  matchRoundId?: string;
  matchRoundLabel?: string;
  eventId?: string;
  detail: string;
  severity: "blocked" | "decision_required" | "planning_note";
  linkTo?: {
    type: "match" | "event" | "round" | "report" | "simulation" | "workbench";
    id: string;
  };
}

export interface InsightOverview {
  totalPlayers: number;
  playersWithNoOpportunity: number;
  playersWithHighLoad: number;
  matchesWithMissingReports: number;
  matchesWithCoverageWarnings: number;
  policyWarningsCount: number;
  plannedActualDeltasCount: number;
  conflictsCount: number;
}

export type GKCapabilityLevel = "YES" | "EMERGENCY" | "NO";

export interface PlayerGKCapability {
  playerId: string;
  goalkeeperAbility: GKCapabilityLevel;
}

// I-002: Opportunity quality (per-selection factual record — see AGENTS.md's I-001 "evidence
// semantics": planned vs realised vs unknown, never inferred).
export interface OpportunityQualityEntry {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  matchId: string;
  matchRoundId: string;
  matchRoundLabel: string;
  matchDate: string;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  role: SelectionRole;
  isCore: boolean;
  supportBurden: boolean;
  plannedPosition: string | null;
  realisedAttendance: "present" | "no_show" | "unknown";
  realisedMinutes: number | null;
  minutesEvidence: "tracked" | "not_tracked";
  cancelled: boolean;
}

// I-003: Opportunity gap (descriptive, not punitive — no debt score).
export interface OpportunityGapRow {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  plannedOpportunities: number;
  realisedOpportunities: number;
  gap: number;
  unavailableRounds: number;
  cancelledMatches: number;
  helperElsewhereCount: number;
  noShowCount: number;
  unknownAttendanceCount: number;
}

// I-004: Position and formation exposure.
export interface PositionExposureRow {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string | null;
  sampleSize: number;
  plannedPositions: Record<string, number>;
  realisedPositions: Record<string, number>;
  formationsExperienced: string[];
  evidenceCompleteness: number;
}

// I-005: Player combinations.
export interface PlayerCombinationRow {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  coSelectionCount: number;
  realisedCoAppearanceCount: number;
  positionPairing: string | null;
  seasonTotal: number;
  recentTotal: number;
  partnershipSubtype?: string | null;
  minutesTogether?: number;
  confidence?: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";
}

// I-006: Continuity vs exploration (round-over-round comparison).
export interface ContinuityRow {
  teamId: string;
  teamName: string;
  matchRoundId: string;
  matchRoundLabel: string;
  previousMatchRoundId: string | null;
  retainedStarterCount: number;
  newPlayerCount: number;
  retainedFormation: boolean | null;
  formationName: string | null;
  previousFormationName: string | null;
  supportPlayerChanges: number;
}

// I-007: Operational health (grouped facts — no composite score).
export interface OperationalHealthGroup {
  category:
    | "incomplete_lineups"
    | "stale_assignments"
    | "missing_reports"
    | "unresolved_reviews"
    | "unowned_upcoming_work"
    | "expiring_support_access"
    | "availability_conflicts"
    | "invalid_rotation_paths"
    | "finalisation_checkpoints";
  label: string;
  count: number;
  entries: OperationalHealthEntry[];
}

export interface OperationalHealthEntry {
  id: string;
  detail: string;
  matchRoundId?: string;
  matchRoundLabel?: string;
  matchId?: string;
  teamId?: string;
  teamName?: string;
}