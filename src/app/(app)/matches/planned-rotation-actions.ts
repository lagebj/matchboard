"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { logMutationEvent } from "@/lib/security/audit-log";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import {
  getPlannedRotation,
  createPlannedRotation,
  updatePlannedRotation,
  deletePlannedRotation,
  validatePlannedChanges,
  type PlannedRotationWithChanges,
  type PlannedRotationChangeData,
} from "@/lib/planned-rotation/planned-rotation";
import type { CreatePlannedRotationInput, UpdatePlannedRotationInput } from "@/lib/planned-rotation/planned-rotation";

async function requireMatchOrgAccess(matchId: string, orgFilter: { type: string; filter: Record<string, unknown> }): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({ where: { id: matchId, ...orgFilter.filter }, select: { id: true } });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireRotationOrgAccess(rotationId: string, orgFilter: { type: string; filter: Record<string, unknown> }): Promise<void> {
  if (orgFilter.type !== "org") return;
  const rotation = await db.plannedRotation.findFirst({ where: { id: rotationId, ...orgFilter.filter }, select: { id: true } });
  if (!rotation) throw new Error("Rotation plan not found or access denied.");
}

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/o/[orgSlug]/matches/${matchId}`);
}

export async function getPlannedRotationAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; rotation: PlannedRotationWithChanges | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    const rotation = await getPlannedRotation(matchId, teamId, ctx.orgFilter);
    return { success: true, rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get rotation plan." };
  }
}

export async function createPlannedRotationAction(
  input: CreatePlannedRotationInput,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const match = await db.match.findFirst({
      where: { id: input.matchId, ...ctx.orgFilter.filter },
      select: { id: true, teamId: true, status: true },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
    if (match.teamId !== input.teamId) return { success: false, error: "Team does not belong to this match." };
    if (match.status === "CANCELLED") return { success: false, error: "Cannot create rotation plan for a cancelled match." };

    const result = await createPlannedRotation(input, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    logMutationEvent("planned_rotation_create", ctx.email || "unknown", "planned_rotation", result.rotation.id, "success");
    revalidateMatchPaths(input.matchId);

    return { success: true, rotation: result.rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create rotation plan." };
  }
}

export async function updatePlannedRotationAction(
  rotationId: string,
  input: UpdatePlannedRotationInput,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    await requireRotationOrgAccess(rotationId, ctx.orgFilter);

    const result = await updatePlannedRotation(rotationId, input, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    const matchId = result.rotation.matchId;
    logMutationEvent("planned_rotation_update", ctx.email || "unknown", "planned_rotation", rotationId, "success");
    revalidateMatchPaths(matchId);

    return { success: true, rotation: result.rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update rotation plan." };
  }
}

export async function deletePlannedRotationAction(
  rotationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const rotation = await db.plannedRotation.findFirst({
      where: { id: rotationId, ...ctx.orgFilter.filter },
      select: { id: true, matchId: true, status: true },
    });
    if (!rotation) return { success: false, error: "Rotation plan not found." };

    const result = await deletePlannedRotation(rotationId, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    logMutationEvent("planned_rotation_delete", ctx.email || "unknown", "planned_rotation", rotationId, "success");
    revalidateMatchPaths(rotation.matchId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete rotation plan." };
  }
}

export async function validatePlannedChangesAction(
  matchId: string,
  teamId: string,
  changes: PlannedRotationChangeData[],
): Promise<{ success: true; issues: string[] } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    await requireMatchOrgAccess(matchId, ctx.orgFilter);

    const selections = await db.selection.findMany({
      where: {
        matchId,
        status: { in: ["DRAFT", "FINALIZED"] },
        match: { teamId },
      },
      select: { playerId: true },
    });
    const squadPlayerIds = new Set(selections.map((s) => s.playerId));

    const issues = validatePlannedChanges(changes, squadPlayerIds);
    return { success: true, issues };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to validate changes." };
  }
}