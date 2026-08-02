import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

export type OperationalContext = {
  season: { id: string; name: string } | null;
  leagueSeason: { id: string; name: string; startDate: Date; endDate: Date } | null;
  matchRound: { id: string; name: string; status: string; hasDraftSelections: boolean; hasMatches: boolean; blockedSignalCount: number } | null;
};

export async function getOperationalContext(orgFilter?: OrgFilterMode): Promise<OperationalContext> {
  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};
  const activePeriods = await db.leagueSeason.findMany({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
      ...orgWhere,
    },
    include: {
      season: { select: { id: true, name: true } },
      matchRounds: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { startDate: "desc" },
    take: 1,
  });

  const period = activePeriods[0];
  if (!period) {
    const anySeason = await db.season.findFirst({ where: orgWhere, orderBy: { createdAt: "desc" } });
    const anyPeriod = await db.leagueSeason.findFirst({ where: orgWhere, orderBy: { createdAt: "desc" } });
    const anyRound = await db.matchRound.findFirst({ where: orgFilter?.type === "org" ? orgFilter.filter : {}, orderBy: { createdAt: "desc" } });

    return {
      season: anySeason ? { id: anySeason.id, name: anySeason.name } : null,
      leagueSeason: anyPeriod
        ? { id: anyPeriod.id, name: anyPeriod.name, startDate: anyPeriod.startDate, endDate: anyPeriod.endDate }
        : null,
      matchRound: anyRound ? await enrichMatchRound(anyRound.id, anyRound.name, anyRound.status) : null,
    };
  }

  const round = period.matchRounds[0];
  if (!round) {
    const latestRound = await db.matchRound.findFirst({
      where: { leagueSeasonId: period.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      season: { id: period.season.id, name: period.season.name },
      leagueSeason: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
      matchRound: latestRound ? await enrichMatchRound(latestRound.id, latestRound.name, latestRound.status) : null,
    };
  }

  return {
    season: { id: period.season.id, name: period.season.name },
    leagueSeason: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
    matchRound: await enrichMatchRound(round.id, round.name, round.status),
  };
}

async function enrichMatchRound(id: string, name: string, status: string): Promise<NonNullable<OperationalContext["matchRound"]>> {
  const [draftCount, matchCount, planIntegrity] = await Promise.all([
    db.selection.count({ where: { matchRoundId: id, status: "DRAFT" } }),
    db.match.count({ where: { matchRoundId: id } }),
    computeRoundPlanIntegrity(id),
  ]);

  return { id, name, status, hasDraftSelections: draftCount > 0, hasMatches: matchCount > 0, blockedSignalCount: planIntegrity.summary.blockerCount };
}

export async function searchEntities(query: string, orgFilter?: OrgFilterMode) {
  if (!query || query.trim().length < 2) return { players: [] as { id: string; name: string; coreTeamName: string }[], teams: [] as { id: string; name: string }[] };

  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};
  const q = query.trim();
  const players = await db.player.findMany({
    where: {
      removedAt: null,
      ...orgWhere,
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeam: { select: { name: true } },
    },
    take: 5,
  });

  const teams = await db.team.findMany({
    where: {
      archivedAt: null,
      name: { contains: q },
      ...orgWhere,
    },
    select: { id: true, name: true },
    take: 5,
  });

  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName,
      coreTeamName: p.coreTeam?.name ?? "Unassigned",
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
  };
}