'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getOrCreateDebrief, saveDraftDebrief, submitDebrief, reopenDebrief, DebriefDomainError } from "@/lib/post-match/debrief/service";
import type { DebriefActionResult } from "@/app/(app)/matches/[matchId]/post-match/debrief-actions";

/**
 * Event equivalent of `debrief-actions.ts` — same service, same result shape, only the ref kind
 * and revalidated paths differ (League/Event parity, ADR-0152 §3).
 */

async function revalidateEventDetail(eventMatchId: string, organisationId: string): Promise<void> {
  const eventMatch = await db.eventMatch.findFirst({ where: { id: eventMatchId, organisationId }, select: { eventId: true } });
  if (eventMatch) revalidatePath(`/events/${eventMatch.eventId}`);
}

export async function getEventDebriefAction(eventMatchId: string): Promise<DebriefActionResult<Awaited<ReturnType<typeof getOrCreateDebrief>>>> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  try {
    const debrief = await getOrCreateDebrief({ kind: "EVENT", eventMatchId }, ctx.organisationId, ctx.email);
    return { success: true, data: debrief };
  } catch (error) {
    return { success: false, error: error instanceof DebriefDomainError ? error.message : "Could not load the debrief." };
  }
}

export async function saveEventDebriefDraftAction(eventMatchId: string, debriefId: string, answers: unknown): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await saveDraftDebrief(debriefId, ctx.organisationId, answers);
  if (!result.success) return { success: false, error: result.error };

  await revalidateEventDetail(eventMatchId, ctx.organisationId);
  return { success: true, data: undefined };
}

export async function submitEventDebriefAction(eventMatchId: string, debriefId: string): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await submitDebrief({ kind: "EVENT", eventMatchId }, debriefId, ctx.organisationId, ctx.email);
  if (!result.success) return { success: false, error: result.error, missing: result.missing };

  await revalidateEventDetail(eventMatchId, ctx.organisationId);
  return { success: true, data: undefined };
}

export async function reopenEventDebriefAction(eventMatchId: string, debriefId: string): Promise<DebriefActionResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await reopenDebrief(debriefId, ctx.organisationId);
  if (!result.success) return { success: false, error: result.error };

  await revalidateEventDetail(eventMatchId, ctx.organisationId);
  return { success: true, data: undefined };
}
