import { db } from "@/lib/db";
import { getOrCreateDefaultGroup } from "@/lib/groups/group-domain";
import {
  getLeagueSeasonDateRange,
  formatLeagueSeasonLabel,
  type LeagueSeasonPart,
} from "@/lib/seasons/league-season";
import { validateMatchFormatDefinition, type MatchFormatDefinition } from "@/lib/live-match/match-format";
import { revalidatePath } from "next/cache";

export type CreateLeagueSeasonResult = {
  success: boolean;
  seasonId?: string;
  leagueSeasonId?: string;
  error?: string;
};

export async function createLeagueSeason(
  organisationId: string,
  data: {
    name?: string;
    year: number;
    part: LeagueSeasonPart;
    footballGroupId?: string;
    // Required for every newly created season (ADR-0146 §1, bundle §02.3) -- existing legacy
    // seasons may stay unconfigured; a new one may not.
    matchFormat: MatchFormatDefinition;
  },
): Promise<CreateLeagueSeasonResult> {
  if (!data.year || data.year < 2000 || data.year > 2100) {
    return { success: false, error: "Year must be between 2000 and 2100." };
  }

  if (!data.part || !["SPRING", "FALL"].includes(data.part)) {
    return { success: false, error: "Part must be SPRING or FALL." };
  }

  const matchFormatErrors = validateMatchFormatDefinition(data.matchFormat);
  if (matchFormatErrors.length > 0) {
    return { success: false, error: `Invalid match format: ${matchFormatErrors.join(", ")}` };
  }

  const dateRange = getLeagueSeasonDateRange(data.year, data.part);
  const defaultName = formatLeagueSeasonLabel({ year: data.year, part: data.part });
  const name = data.name?.trim() || defaultName;

  const existing = await db.leagueSeason.findFirst({
    where: {
      organisationId,
      name,
    },
    select: { id: true },
  });

  if (existing) {
    return { success: false, error: `A league season named "${name}" already exists.` };
  }

  const footballGroupId = data.footballGroupId ?? await getOrCreateDefaultGroup(organisationId);

  let season = await db.season.findFirst({
    where: { organisationId, year: data.year },
    orderBy: { createdAt: "desc" },
  });

  if (!season) {
    season = await db.season.create({
      data: {
        name: `${data.year} Season`,
        year: data.year,
        organisationId,
      },
    });
  }

  const leagueSeason = await db.leagueSeason.create({
    data: {
      name,
      part: data.part,
      seasonId: season.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      organisationId,
      footballGroupId,
      defaultNumberOfPeriods: data.matchFormat.numberOfPeriods,
      defaultPeriodDurationMinutes: data.matchFormat.periodDurationMinutes,
      defaultBreakDurationMinutes: data.matchFormat.breakDurationMinutes,
    },
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return {
    success: true,
    seasonId: season.id,
    leagueSeasonId: leagueSeason.id,
  };
}

export async function getFootballGroupsForOrganisation(
  organisationId: string,
): Promise<Array<{ id: string; name: string }>> {
  const groups = await db.footballGroup.findMany({
    where: { organisationId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return groups;
}