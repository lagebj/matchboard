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
import {
  generateEmergencyRepairOptions,
  type EmergencyRepairOptionsResult,
} from "@/lib/selection/emergency-repair-options";

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

/**
 * Generates a small set of viable pre-kickoff repair alternatives for a player who is currently
 * in the match's draft squad but has just become unavailable. Never applies anything — the coach
 * reviews the options and applies their choice via the normal manual-add/remove actions.
 */
export async function generateEmergencyRepairOptionsAction(
  matchId: string,
  playerId: string,
): Promise<EmergencyRepairOptionsResult> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    return await generateEmergencyRepairOptions(matchId, playerId, ctx.orgFilter);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate repair options." };
  }
}