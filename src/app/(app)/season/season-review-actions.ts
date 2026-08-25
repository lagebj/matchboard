"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function getSeasonReviewAction(leagueSeasonId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return getSeasonReview(leagueSeasonId, ctx.orgFilter);
}