import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { getOrCreateDefaultGroup } from "@/lib/groups/group-domain";
import {
  getLeagueSeasonPartForDate,
  getLeagueSeasonDateRange,
  formatLeagueSeasonLabel,
  type LeagueSeasonPart,
} from "@/lib/seasons/league-season";

export async function ensureMatchRoundIdForDate(startsAt: Date): Promise<string> {
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
      return findOrCreateRound(matchingPeriod.id, matchingPeriod.organisationId, weekLabel);
    }
  }

  return createFullHierarchy(startsAt, weekLabel);
}

async function findOrCreateRound(leagueSeasonId: string, organisationId: string, weekLabel: string): Promise<string> {
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
      organisationId,
    },
  });

  return round.id;
}

async function createFullHierarchy(startsAt: Date, weekLabel: string): Promise<string> {
  const part: LeagueSeasonPart = getLeagueSeasonPartForDate(startsAt);
  const dateRange = getLeagueSeasonDateRange(startsAt.getUTCFullYear(), part);
  const name = formatLeagueSeasonLabel({ year: startsAt.getUTCFullYear(), part });

  const roundId = await db.$transaction(async (tx) => {
    let season = await tx.season.findFirst({ orderBy: { createdAt: "desc" } });
    const organisationId = season?.organisationId ?? "";

    if (!season) {
      season = await tx.season.create({
        data: { name: `${startsAt.getUTCFullYear()} Season`, year: startsAt.getUTCFullYear(), organisationId },
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
      const footballGroupId = await getOrCreateDefaultGroup(season.organisationId);
      period = await tx.leagueSeason.create({
        data: {
          name,
          part,
          seasonId: season.id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          organisationId: season.organisationId,
          footballGroupId,
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
          organisationId: period.organisationId,
        },
      });
    }

    return round.id;
  });

  return roundId;
}