"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createPlayerLock, deletePlayerLock, type PinType } from "@/lib/selection/player-lock";
import { logSecurityEvent } from "@/lib/security/audit-log";

function revalidateRoundPaths(matchRoundId: string): void {
  revalidatePath(`/rounds/${matchRoundId}`);
  revalidatePath(`/o/[orgSlug]/rounds/${matchRoundId}`);
  revalidatePath(`/o/[orgSlug]/teams`);
}

export async function pinPlayerAction(
  matchRoundId: string,
  playerId: string,
  pinType: PinType,
  reason?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    await createPlayerLock({ matchRoundId, playerId, lockType: pinType, reason, lockedBy: ctx.email }, ctx.orgFilter);

    logSecurityEvent({
      category: "mutation",
      action: "manual_override",
      actor: ctx.userId,
      tenant: ctx.organisationId,
      resource: "player_lock",
      resourceId: `${matchRoundId}:${playerId}`,
      result: "success",
      metadata: { pinType, reason },
    });

    revalidateRoundPaths(matchRoundId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to pin player." };
  }
}

export async function unpinPlayerAction(
  matchRoundId: string,
  playerId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    await deletePlayerLock(matchRoundId, playerId, ctx.orgFilter);

    logSecurityEvent({
      category: "mutation",
      action: "manual_override",
      actor: ctx.userId,
      tenant: ctx.organisationId,
      resource: "player_lock",
      resourceId: `${matchRoundId}:${playerId}`,
      result: "success",
      metadata: { unpinned: true },
    });

    revalidateRoundPaths(matchRoundId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to unpin player." };
  }
}
