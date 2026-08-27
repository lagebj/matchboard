"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  analyzeAvailabilityChangeImpact,
  type AvailabilityChangeImpact,
} from "@/lib/selection/availability-impact";
import {
  previewManualAddImpact,
  previewManualRemoveImpact,
  type ManualEditPreview,
} from "@/lib/selection/edit-impact-preview";

export async function analyzeAvailabilityImpactAction(
  playerId: string,
  newAvailability: string,
): Promise<{ success: true; impact: AvailabilityChangeImpact | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const impact = await analyzeAvailabilityChangeImpact(playerId, newAvailability, ctx.orgFilter);
    return { success: true, impact };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to analyze availability impact." };
  }
}

export async function previewManualAddAction(
  matchId: string,
  playerId: string,
  role: string,
): Promise<{ success: true; preview: ManualEditPreview } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const preview = await previewManualAddImpact(matchId, playerId, role, ctx.orgFilter);
    return { success: true, preview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to preview manual add impact." };
  }
}

export async function previewManualRemoveAction(
  matchId: string,
  playerId: string,
): Promise<{ success: true; preview: ManualEditPreview } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const preview = await previewManualRemoveImpact(matchId, playerId, ctx.orgFilter);
    return { success: true, preview };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to preview manual remove impact." };
  }
}