"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import {
  applyPlannedChange,
  skipPlannedChange,
  modifyPlannedChange,
  getNextPlannedChange,
  getPlannedChangesForMatch,
} from "@/lib/planned-rotation/planned-rotation-live-bridge";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/o/[orgSlug]/matches/${matchId}`);
}

export async function applyPlannedChangeAction(
  rotationId: string,
  changeId: string,
  liveEventIds: { outEventId: string; inEventId?: string },
): Promise<{ success: true; outEventId: string; inEventId: string | null; changeId: string } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await applyPlannedChange(rotationId, changeId, liveEventIds, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to apply planned change." };
  }
}

export async function skipPlannedChangeAction(
  rotationId: string,
  changeId: string,
): Promise<{ success: true; changeId: string } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await skipPlannedChange(rotationId, changeId, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to skip planned change." };
  }
}

export async function modifyPlannedChangeAction(
  rotationId: string,
  changeId: string,
  modification: {
    outPlayerId?: string | null;
    inPlayerId?: string | null;
    outPosition?: string | null;
    inPosition?: string | null;
    positionOnly?: boolean;
    approximateMatchSeconds?: number | null;
    notes?: string | null;
    liveEventId?: string;
  },
): Promise<{ success: true; change: PlannedRotationWithChanges["changes"][number] } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await modifyPlannedChange(rotationId, changeId, modification, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to modify planned change." };
  }
}

export async function getNextPlannedChangeAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; change: PlannedRotationWithChanges["changes"][number] | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const change = await getNextPlannedChange(matchId, teamId, ctx.orgFilter);
    return { success: true, change };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get next planned change." };
  }
}

export async function getPlannedChangesForMatchAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; rotation: PlannedRotationWithChanges | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const rotation = await getPlannedChangesForMatch(matchId, teamId, ctx.orgFilter);
    return { success: true, rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get planned changes for match." };
  }
}