"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getMatchInsights, type MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";

/**
 * Client-facing entry point for Match Insights (ADR-0149). Mirrors
 * `getPlannedPartnershipEvidenceAction`'s pattern -- read-only, same-org scoped. `getMatchInsights`
 * itself already scopes every query to `organisationId`, so a wrong/foreign `matchId` resolves to
 * the empty view model rather than leaking another organisation's data.
 */
export async function getMatchInsightsAction(
  matchId: string,
): Promise<{ success: true; viewModel: MatchInsightsViewModel } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const viewModel = await getMatchInsights({ organisationId: ctx.organisationId, matchId });
    return { success: true, viewModel };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load match insights." };
  }
}
