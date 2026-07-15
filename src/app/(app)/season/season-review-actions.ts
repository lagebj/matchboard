"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";

export async function getSeasonReviewAction(leagueSeasonId: string) {
  await requireCoachAccess();
  return getSeasonReview(leagueSeasonId);
}