export type PolicyMode = "league" | "event";

export type PolicyDecisionType =
  | "league_match_selection"
  | "league_round_fairness"
  | "event_squad_generation"
  | "event_helper_selection"
  | "event_lineup_planning"
  | "post_match_report_availability";

export type PolicyFairnessScope =
  | "match"
  | "round"
  | "period"
  | "season"
  | "event"
  | "event_match";

export type PolicyPeriod = "spring" | "fall" | "full_year";

export type PolicyDecisionPhase =
  | "pre_selection"
  | "post_selection"
  | "assistant_recommendation"
  | "report_availability";

export type PolicyPlayerStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "REMOVED"
  | "UNAVAILABLE";

export type PolicyPlayer = {
  id: string;
  displayName: string;
  status: PolicyPlayerStatus;
  availableForContext: boolean;
  unavailableReason?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
  tertiaryPosition?: string | null;
  shirtNumber?: string | null;
  currentTeamIds: string[];
  recentMatchCount?: number;
  seasonMatchCount?: number;
  periodMatchCount?: number;
  goalkeeperAbility?: string | null;
  nonRotatable?: boolean;
  policyTags?: string[];
};

export type PolicyTeam = {
  id: string;
  name: string;
  targetSquadSize?: number | null;
  minSquadSize?: number | null;
  maxSquadSize?: number | null;
};

export type PolicySquad = {
  id: string;
  name?: string | null;
  teamId?: string | null;
  playerIdList: string[];
  primaryGoalkeeperCount: number;
  secondaryGoalkeeperCount: number;
  anyGoalkeeperCount: number;
};

export type PolicyMatch = {
  id: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isCancelled: boolean;
  squadId?: string | null;
  opponentName?: string | null;
};

export type PolicyHistory = {
  playerMatchCountMap: Record<string, number>;
  playerRoleMap: Record<string, string[]>;
  playerRecentSupportCount: Record<string, number>;
};

export type PolicyConstraints = {
  maxSquadSize?: number | null;
  minSquadSize?: number | null;
  targetSquadSize?: number | null;
  requireGoalkeeper?: boolean;
  allowedPositions?: string[];
  blockedPlayerIds?: string[];
};

export type PolicyCandidateSelection = {
  selectedPlayerIds: string[];
  blockedPlayerIds: string[];
  warnedPlayerIds: string[];
};

export type SelectionPolicyInput = {
  context: {
    phase: PolicyDecisionPhase;
    mode: PolicyMode;
    decisionType: PolicyDecisionType;
    fairnessScope?: PolicyFairnessScope;
    generationMode?: "balanced" | "competitive";
    seasonYear?: number;
    period?: PolicyPeriod;
    eventId?: string;
    eventMatchId?: string;
    leagueMatchId?: string;
    teamId?: string;
    squadId?: string;
    opponentId?: string;
    matchDate?: string | null;
    matchTime?: string | null;
    nowIso: string;
    gameFormat?: string | null;
    tacticId?: string | null;
  };
  players: PolicyPlayer[];
  teams: PolicyTeam[];
  squads: PolicySquad[];
  matches: PolicyMatch[];
  history: PolicyHistory;
  constraints: PolicyConstraints;
  candidateSelection?: PolicyCandidateSelection;
};

export type PolicySource = "core" | "default_policy" | "rego" | "solver" | "validation";

export type PolicyWarningSeverity = "info" | "warning" | "blocking";

export type PolicyWarning = {
  code: string;
  severity: PolicyWarningSeverity;
  message: string;
  playerId?: string;
  teamId?: string;
  matchId?: string;
  eventId?: string;
  source?: PolicySource;
};

export type PolicyScoreAdjustment = {
  playerId: string;
  delta: number;
  reason: string;
  code: string;
  source?: PolicySource;
};

export type PolicyExplanation = {
  playerId: string;
  code: string;
  summary: string;
  hardRule?: boolean;
  source?: PolicySource;
};

export type PolicyTag = {
  playerId: string;
  tag: string;
  reason: string;
  source?: PolicySource;
};

export type SelectionPolicyResult = {
  allowedPlayerIds: string[];
  blocked: Record<string, string[]>;
  warnings: PolicyWarning[];
  scoreAdjustments: PolicyScoreAdjustment[];
  explanations: PolicyExplanation[];
  tags: PolicyTag[];
};