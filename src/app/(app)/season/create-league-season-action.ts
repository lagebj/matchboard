"use server";

import { redirect } from "next/navigation";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { createLeagueSeason, getFootballGroupsForOrganisation } from "@/lib/seasons/create-league-season";
import type { LeagueSeasonPart } from "@/lib/seasons/league-season";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { validateMatchFormatDefinition } from "@/lib/live-match/match-format";

export async function createLeagueSeasonAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const yearStr = formData.get("year") as string | null;
  const part = formData.get("part") as string | null;
  const name = formData.get("name") as string | null;
  const footballGroupId = formData.get("footballGroupId") as string | null;

  const year = yearStr ? parseInt(yearStr, 10) : NaN;

  if (!yearStr || isNaN(year) || year < 2000 || year > 2100) {
    return { error: "Year must be between 2000 and 2100." };
  }

  if (!part || !["SPRING", "FALL"].includes(part)) {
    return { error: "Part must be SPRING or FALL." };
  }

  const numberOfPeriodsStr = formData.get("numberOfPeriods") as string | null;
  const periodDurationMinutesStr = formData.get("periodDurationMinutes") as string | null;
  const breakDurationMinutesStr = formData.get("breakDurationMinutes") as string | null;

  const numberOfPeriods = numberOfPeriodsStr ? parseInt(numberOfPeriodsStr, 10) : NaN;
  const periodDurationMinutes = periodDurationMinutesStr ? parseInt(periodDurationMinutesStr, 10) : NaN;
  const breakDurationMinutes = breakDurationMinutesStr ? parseInt(breakDurationMinutesStr, 10) : NaN;

  const matchFormat = { numberOfPeriods, periodDurationMinutes, breakDurationMinutes };
  const matchFormatErrors = validateMatchFormatDefinition(matchFormat);
  if (matchFormatErrors.length > 0) {
    return { error: "Set a valid match format: number of periods, period length, and break length are all required." };
  }

  const result = await createLeagueSeason(ctx.organisationId, {
    year,
    part: part as LeagueSeasonPart,
    name: name || undefined,
    footballGroupId: footballGroupId || undefined,
    matchFormat,
  });

  if (!result.success) {
    return { error: result.error };
  }

  redirect(`/o/${ctx.organisationSlug}/season?created=1`);
}

export async function getFootballGroupsAction(): Promise<Array<{ id: string; name: string }>> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return getFootballGroupsForOrganisation(ctx.organisationId);
}