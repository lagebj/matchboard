import type { PolicyDecisionType } from "@/lib/policies/types";
import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import type { SelectionRole } from "@/generated/prisma/client";

export type SimulationScope =
  | "league_round"
  | "league_date_range"
  | "league_period_remainder"
  | "event"
  | "combined_date_range";

export type SimulationPolicyMode = "default_only" | "default_plus_rego";

export type LeagueSimulationScope = Extract<
  SimulationScope,
  "league_round" | "league_date_range" | "league_period_remainder"
>;

export type SeasonSimulationRequest = {
  scope: SimulationScope;
  seasonYear?: number;
  period?: "spring" | "fall" | "full_year";
  leagueSeasonId?: string;
  roundIds?: string[];
  eventIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  includeLeague: boolean;
  includeEvents: boolean;
  includeCommittedPlans: boolean;
  includeDraftPlans: boolean;
  compareWithCurrentCommitted?: boolean;
  policyMode: SimulationPolicyMode;
};

export type SimulationFairnessFlag =
  | "zero_planned_opportunity"
  | "low_period_participation"
  | "high_recent_load"
  | "eligible_not_selected"
  | "consecutive_support_burden"
  | "gk_coverage_gap"
  | "position_coverage_weakness"
  | "team_disproportionate_support";

export type SimulationFairnessSignal = {
  playerId: string;
  flag: SimulationFairnessFlag;
  label: string;
  roundsAffected: number;
  detail: string;
};

export type SimulationConflictType =
  | "player_league_event_overlap"
  | "helper_conflict"
  | "player_overuse_same_week"
  | "unavailable_player_planned"
  | "gk_conflict"
  | "position_coverage_conflict";

export type SimulationConflict = {
  type: SimulationConflictType;
  playerId: string;
  leagueMatchId?: string;
  eventId?: string;
  eventMatchId?: string;
  roundId?: string;
  detail: string;
};

export type SimulationWarning = {
  code: string;
  severity: "blocked" | "decision_required" | "planning_note";
  message: string;
  playerId?: string;
  teamId?: string;
  roundId?: string;
  matchId?: string;
  source?: string;
};

export type SimulatedPlayerRound = {
  playerId: string;
  roundId: string;
  matchId: string;
  teamId: string;
  role: SelectionRole;
  isSimulation: true;
};

export type SimulatedRoundResult = {
  roundId: string;
  roundName: string;
  matches: SimulatedMatchResult[];
  planIntegritySignals: PlanIntegritySignal[];
  warnings: SimulationWarning[];
  valid: boolean;
};

export type SimulatedMatchResult = {
  matchId: string;
  teamId: string;
  teamName: string;
  opponentName: string;
  selections: SimulatedPlayerRound[];
  blockedPlayers: Record<string, string[]>;
  gkCoverage: { primary: number; secondary: number; any: number };
  selectionCount: number;
};

export type LeagueSimulationResult = {
  rounds: SimulatedRoundResult[];
  playerParticipation: PlayerSimulationParticipation[];
  fairnessSignals: SimulationFairnessSignal[];
  conflicts: SimulationConflict[];
  roundCoverage: RoundCoverageSummary[];
};

export type PlayerSimulationParticipation = {
  playerId: string;
  playerName: string;
  coreTeamId: string;
  plannedRounds: number;
  coreAssignments: number;
  supportAssignments: number;
  developmentAssignments: number;
  squadRepairAssignments: number;
  notSelectedRounds: number;
  unavailableRounds: number;
  roundsWithOpportunity: number;
};

export type RoundCoverageSummary = {
  roundId: string;
  roundName: string;
  totalPlayers: number;
  selectedPlayers: number;
  blockedPlayers: number;
  notSelectedPlayers: number;
  gkCoverageStatus: "adequate" | "marginal" | "gap";
};

export type EventSimulationResult = {
  eventId: string;
  eventName: string;
  squads: SimulatedEventSquad[];
  helpers: SimulatedEventHelper[];
  poolValidation: {
    totalPlayers: number;
    availablePlayers: number;
    missingRatingsCount: number;
    gkCoverageStatus: "adequate" | "marginal" | "gap";
  };
  conflicts: SimulationConflict[];
  warnings: SimulationWarning[];
  valid: boolean;
};

export type SimulatedEventSquad = {
  squadId: string;
  squadName: string;
  intent: string;
  playerCount: number;
  players: { playerId: string; role: string; reason: string }[];
  balance?: {
    averageOverall: number | null;
    gkCount: number;
    positionCoverage: Record<string, number>;
  };
};

export type SimulatedEventHelper = {
  playerId: string;
  fromSquadId: string;
  toMatchId: string;
  plannedRole: string;
  conflict: boolean;
  conflictDetail?: string;
};

export type CombinedSimulationResult = {
  leagueEventConflicts: SimulationConflict[];
  overloadedPlayers: { playerId: string; assignments: number; detail: string }[];
};

export type SeasonSimulationResult = {
  request: SeasonSimulationRequest;
  league?: LeagueSimulationResult;
  events?: EventSimulationResult[];
  combined?: CombinedSimulationResult;
  fairness: SimulationFairnessSummary;
  conflicts: SimulationConflict[];
  warnings: SimulationWarning[];
  policy: SimulationPolicySummary;
  validToCommit: boolean;
  dryRunNotice: true;
  dryRunWarning?: string;
};

export type SimulationFairnessSummary = {
  totalPlayers: number;
  playersWithZeroOpportunity: number;
  playersWithLowParticipation: number;
  playersWithHighLoad: number;
  playersWithEligibleNotSelected: number;
  flags: SimulationFairnessSignal[];
};

export type SimulationPolicySummary = {
  policyVersion: string;
  policyPackId: string | null;
  policyPackVersion: string | null;
  artifactHash: string | null;
  /** OPA/Rego is a standard runtime capability (ADR-0107) — always part of the real pipeline. */
  policyRuntimeStatus: "HEALTHY" | "DEGRADED";
  decisionTypes: PolicyDecisionType[];
  defaultOnlyResultCount: number;
  withRegoResultCount?: number;
  regoDiffSummary?: {
    blockedAddedByRego: number;
    warningsAddedByRego: number;
    validityChanged: boolean;
  };
};

export type SimulationRecommendation = {
  type: "attention" | "suggestion" | "conflict";
  playerId?: string;
  roundId?: string;
  teamId?: string;
  message: string;
  action?: string;
};