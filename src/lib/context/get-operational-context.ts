import { db } from "@/lib/db";

export type OperationalContext = {
  season: { id: string; name: string } | null;
  planningPeriod: { id: string; name: string; startDate: Date; endDate: Date } | null;
  matchRound: { id: string; name: string; status: string } | null;
};

export async function getOperationalContext(): Promise<OperationalContext> {
  const activePeriods = await db.planningPeriod.findMany({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
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
    const anySeason = await db.season.findFirst({ orderBy: { createdAt: "desc" } });
    const anyPeriod = await db.planningPeriod.findFirst({ orderBy: { createdAt: "desc" } });
    const anyRound = await db.matchRound.findFirst({ orderBy: { createdAt: "desc" } });

    return {
      season: anySeason ? { id: anySeason.id, name: anySeason.name } : null,
      planningPeriod: anyPeriod
        ? { id: anyPeriod.id, name: anyPeriod.name, startDate: anyPeriod.startDate, endDate: anyPeriod.endDate }
        : null,
      matchRound: anyRound ? { id: anyRound.id, name: anyRound.name, status: anyRound.status } : null,
    };
  }

  const round = period.matchRounds[0];
  if (!round) {
    const latestRound = await db.matchRound.findFirst({
      where: { planningPeriodId: period.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      season: { id: period.season.id, name: period.season.name },
      planningPeriod: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
      matchRound: latestRound ? { id: latestRound.id, name: latestRound.name, status: latestRound.status } : null,
    };
  }

  return {
    season: { id: period.season.id, name: period.season.name },
    planningPeriod: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
    matchRound: { id: round.id, name: round.name, status: round.status },
  };
}

export async function searchEntities(query: string) {
  if (!query || query.trim().length < 2) return { players: [] as { id: string; name: string; coreTeamName: string }[], teams: [] as { id: string; name: string }[] };

  const q = query.trim();
  const players = await db.player.findMany({
    where: {
      removedAt: null,
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
    },
    select: { id: true, name: true },
    take: 5,
  });

  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName,
      coreTeamName: p.coreTeam.name,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
  };
}