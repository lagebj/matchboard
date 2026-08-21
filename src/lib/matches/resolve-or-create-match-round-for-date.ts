import { db } from "@/lib/db";
import { formatIsoWeekKey, formatIsoWeekLabel, getWeekRange } from "@/lib/date-utils";
import type { PrismaClient } from "@/generated/prisma/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

type ResolveInput = {
  leagueSeasonId: string;
  startsAt: Date;
  organisationId: string;
  tx?: TransactionClient;
};

export type ResolvedMatchRound = {
  roundId: string;
  roundName: string;
  created: boolean;
  isoWeekLabel: string;
};

export class AmbiguousRoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousRoundError";
  }
}

export class DateOutsideLeagueSeasonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateOutsideLeagueSeasonError";
  }
}

export async function resolveOrCreateMatchRoundForDate(
  input: ResolveInput,
): Promise<ResolvedMatchRound> {
  const { leagueSeasonId, startsAt, organisationId } = input;
  const client = input.tx ?? db;

  const period = await client.leagueSeason.findFirst({
    where: { id: leagueSeasonId, organisationId },
    select: { id: true, startDate: true, endDate: true, organisationId: true },
  });

  if (!period) {
    throw new DateOutsideLeagueSeasonError("League season not found.");
  }

  if (startsAt < period.startDate || startsAt > period.endDate) {
    throw new DateOutsideLeagueSeasonError(
      "This date is outside the current league season. Move the match to a league season covering the new date or update the league season first.",
    );
  }

  const isoWeekLabel = formatIsoWeekLabel(startsAt);
  const { startsAt: weekStart, endsAt: weekEnd } = getWeekRange(startsAt);

  const candidates = await client.matchRound.findMany({
    where: {
      leagueSeasonId,
      OR: [
        { name: isoWeekLabel },
        {
          matches: {
            some: {
              startsAt: {
                gte: weekStart,
                lte: weekEnd,
              },
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (candidates.length > 1) {
    throw new AmbiguousRoundError(
      "More than one round matches the selected match week. Resolve the duplicate round setup before rescheduling this match.",
    );
  }

  if (candidates.length === 1) {
    return {
      roundId: candidates[0].id,
      roundName: candidates[0].name,
      created: false,
      isoWeekLabel,
    };
  }

  const created = await client.matchRound.create({
    data: {
      name: isoWeekLabel,
      leagueSeasonId,
      organisationId: period.organisationId,
      // No explicit status: the schema default (DRAFT) applies, matching every other round-
      // creation site. NOT_GENERATED is a UI-derived display state (deriveRoundStatus(), based on
      // whether any selections have been generated yet) — it was never a valid persisted value
      // (Phase 11 Sec68, ADR-0083).
    },
    select: { id: true, name: true },
  });

  return {
    roundId: created.id,
    roundName: created.name,
    created: true,
    isoWeekLabel,
  };
}

export function isSameIsoWeek(a: Date, b: Date): boolean {
  return formatIsoWeekKey(a) === formatIsoWeekKey(b);
}

export { formatIsoWeekKey };