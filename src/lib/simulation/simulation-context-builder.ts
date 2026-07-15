import "server-only";

import { db } from "@/lib/db";
import type { LeagueSeasonPart } from "@/lib/seasons/league-season";

export type SimulationContext = {
  leagueSeasonId: string;
  seasonYear: number;
  period: LeagueSeasonPart;
  roundIds: string[];
  teams: SimulationTeam[];
  players: SimulationPlayer[];
  rotationPaths: SimulationRotationPath[];
  availabilities: SimulationAvailability[];
  matches: SimulationMatch[];
  rounds: SimulationRound[];
  finalizedHistory: SimulationFinalizedHistory[];
  movementCandidates: SimulationMovementCandidate[];
};

export type SimulationTeam = {
  id: string;
  name: string;
  targetSquadSize: number | null;
  minAcceptedSquadSize: number;
  maxSquadSize: number;
  supportPriority: number;
};

export type SimulationPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  coreTeamId: string | null;
  primaryPosition: string;
  goalkeeperAbility: string;
  supportSuitability: string;
  developmentReadiness: string;
  nonRotatable: boolean;
  active: boolean;
};

export type SimulationRotationPath = {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  role: string;
  active: boolean;
  priority: number | null;
  minimumCount: number | null;
  targetCount: number | null;
  maximumCount: number | null;
};

export type SimulationAvailability = {
  playerId: string;
  matchRoundId: string;
  status: string;
};

export type SimulationMatch = {
  id: string;
  matchRoundId: string;
  teamId: string;
  opponentTeamId: string | null;
  opponentName: string;
  homeAway: string;
  startsAt: Date | null;
  isCancelled: boolean;
};

export type SimulationRound = {
  id: string;
  name: string;
  status: string;
};

export type SimulationFinalizedHistory = {
  playerId: string;
  matchId: string;
  matchRoundId: string;
  role: string;
  controlledDoubleLoad: boolean;
};

export type SimulationMovementCandidate = {
  id: string;
  playerId: string;
  rotationPathId: string;
  role: string;
  status: string;
};

export async function buildLeagueSimulationContext(
  leagueSeasonId: string,
  options?: {
    roundIds?: string[];
    includeFinalizedHistory?: boolean;
  },
): Promise<SimulationContext> {
  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    include: { season: true },
  });

  if (!leagueSeason) {
    throw new Error(`League season not found: ${leagueSeasonId}`);
  }

  const period = leagueSeason.part as LeagueSeasonPart;

  const rounds = await db.matchRound.findMany({
    where: {
      leagueSeasonId,
      ...(options?.roundIds?.length ? { id: { in: options.roundIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const teamIds = await db.match.findMany({
    where: { matchRoundId: { in: roundIds } },
    select: { teamId: true },
    distinct: ["teamId"],
  }).then((rows) => rows.map((r) => r.teamId));

  const teams = await db.team.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      name: true,
      targetSquadSize: true,
      minAcceptedSquadSize: true,
      maxSquadSize: true,
      supportPriority: true,
    },
  });

  const players = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      coreTeamId: { in: teamIds },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      active: true,
      coreTeamId: true,
      primaryPosition: true,
      goalkeeperAbility: true,
      supportSuitability: true,
      developmentReadiness: true,
      nonRotatable: true,
    },
  });

  const simulationPlayers: SimulationPlayer[] = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    coreTeamId: p.coreTeamId,
    primaryPosition: p.primaryPosition,
    goalkeeperAbility: p.goalkeeperAbility,
    supportSuitability: p.supportSuitability,
    developmentReadiness: p.developmentReadiness,
    nonRotatable: p.nonRotatable,
    active: p.active,
  }));

  const rotationPaths = await db.rotationPath.findMany({
    where: {
      OR: [
        { fromTeamId: { in: teamIds } },
        { toTeamId: { in: teamIds } },
      ],
      active: true,
    },
    select: {
      id: true,
      fromTeamId: true,
      toTeamId: true,
      role: true,
      active: true,
      priority: true,
      minimumCount: true,
      targetCount: true,
      maximumCount: true,
    },
  });

  const availabilities = await db.availability.findMany({
    where: {
      matchRoundId: { in: roundIds },
    },
    select: {
      playerId: true,
      matchRoundId: true,
      status: true,
    },
  });

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: roundIds },
    },
    select: {
      id: true,
      matchRoundId: true,
      teamId: true,
      opponentTeamId: true,
      opponentTeam: { select: { displayName: true } },
      homeAway: true,
      startsAt: true,
      status: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const simulationMatches: SimulationMatch[] = matches.map((m) => ({
    id: m.id,
    matchRoundId: m.matchRoundId,
    teamId: m.teamId,
    opponentTeamId: m.opponentTeamId,
    opponentName: m.opponentTeam?.displayName ?? "Unknown",
    homeAway: m.homeAway,
    startsAt: m.startsAt,
    isCancelled: m.status === "CANCELLED",
  }));

  const simulationRounds: SimulationRound[] = rounds.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
  }));

  let finalizedHistory: SimulationFinalizedHistory[] = [];
  if (options?.includeFinalizedHistory !== false) {
    const selections = await db.selection.findMany({
      where: {
        status: "FINALIZED",
        match: {
          matchRound: { leagueSeasonId },
        },
      },
      select: {
        playerId: true,
        matchId: true,
        matchRoundId: true,
        role: true,
        controlledDoubleLoad: true,
      },
    });

    finalizedHistory = selections.map((s) => ({
      playerId: s.playerId,
      matchId: s.matchId,
      matchRoundId: s.matchRoundId,
      role: s.role,
      controlledDoubleLoad: s.controlledDoubleLoad,
    }));
  }

  const movementCandidates = await db.movementCandidate.findMany({
    where: {
      status: "ACTIVE",
      rotationPath: {
        OR: [
          { fromTeamId: { in: teamIds } },
          { toTeamId: { in: teamIds } },
        ],
      },
    },
    select: {
      id: true,
      playerId: true,
      rotationPathId: true,
      role: true,
      status: true,
    },
  });

  return {
    leagueSeasonId,
    seasonYear: leagueSeason.season.year,
    period,
    roundIds,
    teams,
    players: simulationPlayers,
    rotationPaths,
    availabilities,
    matches: simulationMatches,
    rounds: simulationRounds,
    finalizedHistory,
    movementCandidates,
  };
}