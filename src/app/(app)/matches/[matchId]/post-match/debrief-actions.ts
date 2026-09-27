'use server'

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getOrCreateDebrief, saveDraftDebrief, submitDebrief, reopenDebrief, type DebriefReportRef } from "@/lib/post-match/debrief/service";
import { DebriefDomainError } from "@/lib/post-match/debrief/service";

export type DebriefActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string; missing?: string[] };

export async function getDebriefAction(matchId: string): Promise<DebriefActionResult<Awaited<ReturnType<typeof getOrCreateDebrief>>>> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const ref: DebriefReportRef = { kind: "LEAGUE", matchId };
  try {
    const debrief = await getOrCreateDebrief(ref, ctx.organisationId, ctx.email);
    return { success: true, data: debrief };
  } catch (error) {
    return { success: false, error: error instanceof DebriefDomainError ? error.message : "Could not load the debrief." };
  }
}

export async function saveDebriefDraftAction(matchId: string, debriefId: string, answers: unknown): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await saveDraftDebrief(debriefId, ctx.organisationId, answers);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath(`/matches/${matchId}/post-match`);
  return { success: true, data: undefined };
}

export async function submitDebriefAction(matchId: string, debriefId: string): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await submitDebrief({ kind: "LEAGUE", matchId }, debriefId, ctx.organisationId, ctx.email);
  if (!result.success) return { success: false, error: result.error, missing: result.missing };

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/post-match`);
  return { success: true, data: undefined };
}

export async function reopenDebriefAction(matchId: string, debriefId: string): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await reopenDebrief(debriefId, ctx.organisationId);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath(`/matches/${matchId}/post-match`);
  return { success: true, data: undefined };
}
