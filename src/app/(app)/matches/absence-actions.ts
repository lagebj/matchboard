"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess, requirePlayerGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { markMatchAbsence, clearMatchAbsence } from "@/lib/reports/report-mutations";
import type { PlannedAbsenceReason } from "@/generated/prisma/client";

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/post-match`);
  revalidatePath(`/rounds`);
  revalidatePath(`/fixtures`);
}

/**
 * Pre-match/match-specific player absence (production consistency pass item #3). Marks an
 * assigned player Away/Sick/No-show/Declined for one specific match — the player's Selection
 * (round/team assignment) is untouched; this only affects this one match's participation state.
 * Available before or around kick-off, not only after the match via the post-match report.
 */
export async function markMatchAbsenceAction(
  matchId: string,
  playerId: string,
  reason: PlannedAbsenceReason,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchGroupAccess(ctx, matchId);
  await requirePlayerGroupAccess(ctx, playerId);

  const result = await markMatchAbsence(matchId, { playerId, reason, note }, ctx.orgFilter);
  if (!result.success) return { success: false, error: result.error };

  revalidateMatchPaths(matchId);
  return { success: true };
}

/** Restores a player marked absent back to participating, before the report is locked. */
export async function clearMatchAbsenceAction(
  matchId: string,
  playerId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchGroupAccess(ctx, matchId);
  await requirePlayerGroupAccess(ctx, playerId);

  const result = await clearMatchAbsence(matchId, playerId, ctx.orgFilter);
  if (!result.success) return { success: false, error: result.error };

  revalidateMatchPaths(matchId);
  return { success: true };
}
