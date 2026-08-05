"use server";

import { redirect } from "next/navigation";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { createLeagueSeason, getFootballGroupsForOrganisation } from "@/lib/seasons/create-league-season";
import type { LeagueSeasonPart } from "@/lib/seasons/league-season";

export async function createLeagueSeasonAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requireActorContext();
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

  const result = await createLeagueSeason(ctx.organisationId, {
    year,
    part: part as LeagueSeasonPart,
    name: name || undefined,
    footballGroupId: footballGroupId || undefined,
  });

  if (!result.success) {
    return { error: result.error };
  }

  redirect(`/o/${ctx.organisationSlug}/season?created=1`);
}

export async function getFootballGroupsAction(): Promise<Array<{ id: string; name: string }>> {
  const ctx = await requireActorContext();
  return getFootballGroupsForOrganisation(ctx.organisationId);
}