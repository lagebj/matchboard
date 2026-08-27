"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getRotationVsActual, type RotationVsActualSummary } from "@/lib/planned-rotation/rotation-vs-actual";

export async function getRotationVsActualAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; summary: RotationVsActualSummary | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const summary = await getRotationVsActual(matchId, teamId, ctx.orgFilter);
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get rotation vs actual comparison." };
  }
}