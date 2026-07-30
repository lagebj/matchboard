"use server";

import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";

export async function getSeasonReviewAction(leagueSeasonId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  if (orgFilter.type === "org") {
    const leagueSeason = await db.leagueSeason.findFirst({
      where: { id: leagueSeasonId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!leagueSeason) throw new Error("League season not found or access denied.");
  }

  return getSeasonReview(leagueSeasonId);
}