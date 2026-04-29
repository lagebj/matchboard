import { db } from "@/lib/db";
import { formatIsoWeekKey, formatIsoWeekLabel } from "@/lib/date-utils";

export async function ensureMatchRoundIdForDate(startsAt: Date): Promise<string> {
  const weekKey = formatIsoWeekKey(startsAt);
  const weekLabel = formatIsoWeekLabel(startsAt);

  const season = await db.season.findFirst({ orderBy: { createdAt: "desc" } });

  if (season) {
    const matchingPeriod = await db.planningPeriod.findFirst({
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

async function findOrCreateRound(planningPeriodId: string, weekKey: string, weekLabel: string): Promise<string> {
  const existing = await db.matchRound.findFirst({
    where: {
      planningPeriodId,
      name: weekLabel,
    },
  });

  if (existing) {
    return existing.id;
  }

  const round = await db.matchRound.create({
    data: {
      name: weekLabel,
      planningPeriodId,
    },
  });

  return round.id;
}

async function createFullHierarchy(startsAt: Date, weekKey: string, weekLabel: string): Promise<string> {
  const periodStart = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const roundId = await db.$transaction(async (tx) => {
    let season = await tx.season.findFirst({ orderBy: { createdAt: "desc" } });
    if (!season) {
      season = await tx.season.create({
        data: { name: `${startsAt.getUTCFullYear()} Season` },
      });
    }

    let period = await tx.planningPeriod.findFirst({
      where: {
        seasonId: season.id,
        startDate: { lte: startsAt },
        endDate: { gte: startsAt },
      },
    });

    if (!period) {
      period = await tx.planningPeriod.create({
        data: {
          name: `${periodStart.toLocaleString("en", { month: "long", timeZone: "UTC" })} ${startsAt.getUTCFullYear()}`,
          seasonId: season.id,
          startDate: periodStart,
          endDate: periodEnd,
        },
      });
    }

    let round = await tx.matchRound.findFirst({
      where: {
        planningPeriodId: period.id,
        name: weekLabel,
      },
    });

    if (!round) {
      round = await tx.matchRound.create({
        data: {
          name: weekLabel,
          planningPeriodId: period.id,
        },
      });
    }

    return round.id;
  });

  return roundId;
}