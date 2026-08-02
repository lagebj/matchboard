"use server";

import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";

export async function getSeasonReviewAction(leagueSeasonId: string) {
  const ctx = await requireActorContext();

  {
    const leagueSeason = await db.leagueSeason.findFirst({
      where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!leagueSeason) throw new Error("League season not found or access denied.");
  }

  return getSeasonReview(leagueSeasonId);
}