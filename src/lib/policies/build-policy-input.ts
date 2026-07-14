import type {
  SelectionPolicyInput,
  PolicyPlayer,
  PolicyTeam,
  PolicySquad,
  PolicyMatch,
  PolicyHistory,
  PolicyConstraints,
  PolicyMode,
  PolicyDecisionPhase,
} from "./types";

type PrismaPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  active: boolean;
  removedAt: Date | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string;
  nonRotatable: boolean;
  shirtNumber: number | null;
  coreTeamId: string | null;
  coreTeam?: { id: string; name: string } | null;
  availabilities?: Array<{
    status: string;
    matchRoundId: string;
    note?: string | null;
  }>;
  selections?: Array<{
    id: string;
    role: string;
    status: string;
    match: { matchRoundId: string };
  }>;
};

type PrismaTeam = {
  id: string;
  name: string;
  targetSquadSize: number | null;
  minSquadSize: number | null;
  maxSquadSize: number | null;
};

export function mapPlayerStatus(
  player: PrismaPlayer,
): "ACTIVE" | "INACTIVE" | "REMOVED" {
  if (player.removedAt) return "REMOVED";
  if (!player.active) return "INACTIVE";
  return "ACTIVE";
}

export function buildPolicyInput(args: {
  mode: PolicyMode;
  phase: PolicyDecisionPhase;
  players: PrismaPlayer[];
  teams: PrismaTeam[];
  squads?: Array<{
    id: string;
    name?: string | null;
    teamId?: string | null;
    playerIdList: string[];
    primaryGoalkeeperCount: number;
    anyGoalkeeperCount: number;
  }>;
  matches?: Array<{
    id: string;
    startsAt: Date | null;
    endsAt?: Date | null;
    matchStatus?: string;
    squadId?: string | null;
    opponentName?: string | null;
  }>;
  matchDate?: string | null;
  matchTime?: string | null;
  gameFormat?: string | null;
  teamId?: string;
  eventId?: string;
  eventMatchId?: string;
  leagueMatchId?: string;
  opponentId?: string;
  seasonYear?: number;
  period?: "spring" | "fall" | "full_year";
  nowIso?: string;
  constraints?: Partial<PolicyConstraints>;
  recentMatchCounts?: Record<string, number>;
  seasonMatchCounts?: Record<string, number>;
  periodMatchCounts?: Record<string, number>;
}): SelectionPolicyInput {
  const now = args.nowIso ?? new Date().toISOString();

  const players: PolicyPlayer[] = args.players.map((p) => {
    const status = mapPlayerStatus(p);
    const availableForContext =
      status === "ACTIVE" &&
      !p.availabilities?.some((a) => a.status === "UNAVAILABLE");

    return {
      id: p.id,
      displayName: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
      status,
      availableForContext,
      unavailableReason: p.availabilities?.find((a) => a.status === "UNAVAILABLE")?.note ?? null,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      shirtNumber: p.shirtNumber != null ? String(p.shirtNumber) : null,
      currentTeamIds: p.coreTeamId ? [p.coreTeamId] : [],
      recentMatchCount: args.recentMatchCounts?.[p.id],
      seasonMatchCount: args.seasonMatchCounts?.[p.id],
      periodMatchCount: args.periodMatchCounts?.[p.id],
      goalkeeperAbility: p.goalkeeperAbility,
      nonRotatable: p.nonRotatable,
    };
  });

  const teams: PolicyTeam[] = args.teams.map((t) => ({
    id: t.id,
    name: t.name,
    targetSquadSize: t.targetSquadSize,
    minSquadSize: t.minSquadSize,
    maxSquadSize: t.maxSquadSize,
  }));

  const squads: PolicySquad[] = (args.squads ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? null,
    teamId: s.teamId ?? null,
    playerIdList: s.playerIdList,
    primaryGoalkeeperCount: s.primaryGoalkeeperCount,
    anyGoalkeeperCount: s.anyGoalkeeperCount,
  }));

  const matches: PolicyMatch[] = (args.matches ?? []).map((m) => ({
    id: m.id,
    startsAt: m.startsAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
    isCancelled: m.matchStatus === "CANCELLED",
    squadId: m.squadId ?? null,
    opponentName: m.opponentName ?? null,
  }));

  const history: PolicyHistory = {
    playerMatchCountMap: {},
    playerRoleMap: {},
    playerRecentSupportCount: {},
  };

  const constraints: PolicyConstraints = {
    maxSquadSize: args.constraints?.maxSquadSize ?? null,
    minSquadSize: args.constraints?.minSquadSize ?? null,
    targetSquadSize: args.constraints?.targetSquadSize ?? null,
    requireGoalkeeper: args.constraints?.requireGoalkeeper,
    allowedPositions: args.constraints?.allowedPositions,
    blockedPlayerIds: args.constraints?.blockedPlayerIds,
  };

  return {
    context: {
      phase: args.phase,
      mode: args.mode,
      seasonYear: args.seasonYear,
      period: args.period,
      eventId: args.eventId,
      eventMatchId: args.eventMatchId,
      leagueMatchId: args.leagueMatchId,
      teamId: args.teamId,
      opponentId: args.opponentId,
      matchDate: args.matchDate,
      matchTime: args.matchTime,
      nowIso: now,
      gameFormat: args.gameFormat,
      tacticId: null,
    },
    players,
    teams,
    squads,
    matches,
    history,
    constraints,
  };
}
