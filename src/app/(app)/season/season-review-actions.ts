"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";

export async function getSeasonReviewAction(leagueSeasonId: string) {
  const ctx = await requirePageActorContext();

  return getSeasonReview(leagueSeasonId, ctx.orgFilter);
}