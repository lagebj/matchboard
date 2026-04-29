import { type Match, type Player, SelectionRole, SelectionStatus, type Team } from "@/generated/prisma/client";
import { getFloatingHistory } from "@/lib/selection/get-floating-history";

export type PathDestination = {
  cooldownRounds: number | null;
  fromTeamId: string;
  role: string;
  toTeamId: string;
};

export type PlayerRecord = Player & {
  coreTeam: Pick<Team, "id" | "name">;
  rotationPathsFromCoreTeam: PathDestination[];
};

export type MatchRecord = Pick<Match, "id" | "startsAt" | "teamId"> & {
  team: Pick<Team, "developmentSlots" | "id" | "maxSquadSize" | "maxSupportCount" | "minCorePlayers" | "minSupportPlayers" | "name" | "targetSupportCount"> & {
    supportPriority: number;
  };
  developmentSlots: number;
  developmentSourceTeamIds: string[];
  supportSourceTeamIds: string[];
  supportSourceTeamNames: string[];
};

export type RegisteredSelectionSnapshot = {
  match: MatchRecord;
  players: Array<{
    playerId: string;
    roleType: SelectionRole;
  }>;
  status: SelectionStatus;
};

export type EvaluatedPlayer = {
  player: PlayerRecord;
  playerName: string;
  playerPosition: string;
};

export type RotationCandidateCategory = "DEVELOPMENT" | "SUPPORT" | "BACKFILL" | "CONFIDENCE_REBUILD";

export type EligibleRotationPlayer = EvaluatedPlayer & {
  candidateCategory: RotationCandidateCategory;
  eligibilityExplanation: string;
};

export type RotationCandidate = EvaluatedPlayer & {
  candidateCategory: RotationCandidateCategory;
  chosenPosition: string;
  cooldownBlocked: boolean;
  cooldownBlockReason: string | null;
  eligibilityExplanation: string;
  floatingHistory: Awaited<ReturnType<typeof getFloatingHistory>>;
  missedCoreMatchThisWeek: RegisteredSelectionSnapshot | null;
  positionMatchLevel: "primary" | "secondary" | "tertiary" | "none";
  priorityScore: number;
  registeredAppearanceCount: number;
  recentLoadScore: number;
  suitabilityScore: number;
};

export type CoreCandidate = EvaluatedPlayer & {
  higherPriorityOpportunity: {
    kind: "development" | "support";
    match: MatchRecord;
  } | null;
  registeredAppearanceCount: number;
};

export type MostRecentRegisteredAppearance = {
  match: MatchRecord;
  roleType: SelectionRole;
  status: SelectionStatus;
};