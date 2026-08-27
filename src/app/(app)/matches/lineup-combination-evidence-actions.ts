"use server";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  getSeasonCombinationEvidence,
  aggregateSeasonCombinations,
  selectRelevantPartnerships,
  type SeasonCombinationSummary,
} from "@/lib/evidence/combination-aggregation";

/**
 * Season partnership evidence relevant to a specific set of players planned to be on the pitch
 * together (line-up planning, rotation planning) — never per-match evidence, since the match this
 * planning happens for has not been played yet. Shared by the Tactics tab and the Rotations tab
 * so both surfaces read the exact same evidence for the exact same season (Phase 7).
 */
export async function getPlannedPartnershipEvidenceAction(
  matchId: string,
  playerIds: string[],
): Promise<{ success: true; summaries: SeasonCombinationSummary[] } | { success: false; error: string }> {
  try {
    if (playerIds.length < 2) return { success: true, summaries: [] };

    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: { matchRound: { select: { leagueSeasonId: true } } },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };

    const evidence = await getSeasonCombinationEvidence(match.matchRound.leagueSeasonId);
    const summaries = aggregateSeasonCombinations(evidence);

    return { success: true, summaries: selectRelevantPartnerships(playerIds, summaries) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load combination evidence." };
  }
}
