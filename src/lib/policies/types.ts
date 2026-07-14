export type PolicyMode = "league" | "event";

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
    seasonYear?: number;
    period?: PolicyPeriod;
    eventId?: string;
    eventMatchId?: string;
    leagueMatchId?: string;
    teamId?: string;
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

export type PolicyWarningSeverity = "info" | "warning" | "blocking";

export type PolicyWarning = {
  code: string;
  severity: PolicyWarningSeverity;
  message: string;
  playerId?: string;
  teamId?: string;
  matchId?: string;
  eventId?: string;
};

export type PolicyScoreAdjustment = {
  playerId: string;
  delta: number;
  reason: string;
  code: string;
};

export type PolicyExplanation = {
  playerId: string;
  code: string;
  summary: string;
  hardRule?: boolean;
};

export type PolicyTag = {
  playerId: string;
  tag: string;
  reason: string;
};

export type SelectionPolicyResult = {
  allowedPlayerIds: string[];
  blocked: Record<string, string[]>;
  warnings: PolicyWarning[];
  scoreAdjustments: PolicyScoreAdjustment[];
  explanations: PolicyExplanation[];
  tags: PolicyTag[];
};

export type PolicyRuleCondition = {
  field: string;
  op: PolicyConditionOp;
  value?: string | number | boolean | null;
  values?: (string | number)[];
};

export type PolicyConditionGroup = {
  all?: PolicyRuleCondition[];
  any?: PolicyRuleCondition[];
};

export type PolicyConditionOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists"
  | "contains";

export type PolicyRuleEffect = "deny" | "warning" | "score_adjustment" | "tag";

export type PolicyRule = {
  id: string;
  effect: PolicyRuleEffect;
  when: PolicyConditionGroup;
  reason?: string;
  scoreAdjustment?: number;
  warning?: {
    code: string;
    severity: PolicyWarningSeverity;
    message: string;
  };
  tag?: string;
};

export type PolicyPack = {
  id: string;
  name: string;
  version: string;
  description?: string;
  rules: PolicyRule[];
};