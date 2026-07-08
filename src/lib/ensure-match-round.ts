import { db } from "@/lib/db";
import { formatIsoWeekKey, formatIsoWeekLabel } from "@/lib/date-utils";
import {
  getLeagueSeasonPartForDate,
  getLeagueSeasonDateRange,
  formatLeagueSeasonLabel,
  type LeagueSeasonPart,
} from "@/lib/seasons/league-season";

export async function ensureMatchRoundIdForDate(startsAt: Date): Promise<string> {
  const weekKey = formatIsoWeekKey(startsAt);
  const weekLabel = formatIsoWeekLabel(startsAt);

  const season = await db.season.findFirst({ orderBy: { createdAt: "desc" } });

  if (season) {
    const matchingPeriod = await db.leagueSeason.findFirst({
      where: {
        seasonId: season.id,
        startDate: { lte: startsAt },
        endDate: { gte: startsAt },
      },
      orderBy: { startDate: "desc" },
    });

    if (matchingPeriod) {
      return findOrCreateRound(matchingPeriod.id, weekKey, weekLabel);
    }
  }

  return createFullHierarchy(startsAt, weekKey, weekLabel);
}

async function findOrCreateRound(leagueSeasonId: string, weekKey: string, weekLabel: string): Promise<string> {
  const existing = await db.matchRound.findFirst({
    where: {
      leagueSeasonId,
      name: weekLabel,
    },
  });

  if (existing) {
    return existing.id;
  }

  const round = await db.matchRound.create({
    data: {
      name: weekLabel,
      leagueSeasonId,
    },
  });

  return round.id;
}

async function createFullHierarchy(startsAt: Date, weekKey: string, weekLabel: string): Promise<string> {
  const part: LeagueSeasonPart = getLeagueSeasonPartForDate(startsAt);
  const dateRange = getLeagueSeasonDateRange(startsAt.getUTCFullYear(), part);
  const name = formatLeagueSeasonLabel({ year: startsAt.getUTCFullYear(), part });

  const roundId = await db.$transaction(async (tx) => {
    let season = await tx.season.findFirst({ orderBy: { createdAt: "desc" } });
    if (!season) {
      season = await tx.season.create({
        data: { name: `${startsAt.getUTCFullYear()} Season`, year: startsAt.getUTCFullYear() },
      });
    }

    let period = await tx.leagueSeason.findFirst({
      where: {
        seasonId: season.id,
        startDate: { lte: startsAt },
        endDate: { gte: startsAt },
      },
    });

    if (!period) {
      period = await tx.leagueSeason.create({
        data: {
          name,
          part,
          seasonId: season.id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      });
    }

    let round = await tx.matchRound.findFirst({
      where: {
        leagueSeasonId: period.id,
        name: weekLabel,
      },
    });

    if (!round) {
      round = await tx.matchRound.create({
        data: {
          name: weekLabel,
          leagueSeasonId: period.id,
        },
      });
    }

    return round.id;
  });

  return roundId;
}