"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createThread, addObservation } from "@/lib/planned-rotation/development-thread";
import { logSecurityEvent } from "@/lib/security/audit-log";

export type AssistantCoachActionResult = { success: true } | { success: false; error: string };

const MAX_FOCUS_LENGTH = 200;

/**
 * Explicit coach promotion of an Assistant Coach hypothesis into a real, human-confirmed
 * development-thread observation (ADR-0155 §8, source bundle §07's "Persistence": "create a new
 * human-confirmed assessment using existing evidence conventions ... preserve provenance that it
 * originated from Assistant Coach ... do not change earlier assessments"). Writes through the
 * same `createThread`/`addObservation` path a coach uses manually and the one other AI
 * capabilities already reuse for their own development-observation confirmations
 * (`confirmAiDevelopmentSuggestionAction`) -- never a second write path.
 *
 * Unlike the shared AiAdvisorInsight capabilities' `confirm_development_observation` action, the
 * hypothesis schema itself carries no AI-proposed category (bundle §07's hypothesis shape has no
 * `suggestedAction` field) -- the coach supplies `focus` themselves, since only a human should
 * decide how this hypothesis fits into the player's own development plan.
 */
export async function confirmAssistantCoachHypothesisAction(
  orgSlug: string,
  hypothesisId: string,
  focus: string,
): Promise<AssistantCoachActionResult> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const trimmedFocus = focus.trim();
  if (!trimmedFocus || trimmedFocus.length > MAX_FOCUS_LENGTH) {
    return { success: false, error: `Focus must be 1-${MAX_FOCUS_LENGTH} characters.` };
  }

  const hypothesis = await db.assistantCoachHypothesis.findFirst({
    where: { id: hypothesisId, organisationId: ctx.organisationId, state: "ACTIVE" },
    include: { run: { select: { playerId: true } } },
  });
  if (!hypothesis) {
    return { success: false, error: "This hypothesis is no longer available." };
  }

  const player = await db.player.findFirst({ where: { id: hypothesis.run.playerId, organisationId: ctx.organisationId }, select: { id: true } });
  if (!player) return { success: false, error: "Player not found." };

  let threadId: string;
  try {
    const thread = await createThread(
      { playerId: player.id, focus: trimmedFocus, rationale: "Promoted from an Assistant Coach hypothesis.", recordedBy: ctx.email },
      ctx.orgFilter,
    );
    threadId = thread.id;
    await addObservation(
      { threadId, evidence: hypothesis.statement, context: "Promoted from an Assistant Coach hypothesis.", recordedBy: ctx.email },
      ctx.orgFilter,
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not promote this hypothesis." };
  }

  // Never changes an earlier promotion/dismissal -- only ever moves ACTIVE -> PROMOTED once.
  await db.assistantCoachHypothesis.update({
    where: { id: hypothesisId },
    data: { state: "PROMOTED", promotedDevelopmentThreadId: threadId, promotedAt: new Date(), promotedBy: ctx.email },
  });

  logSecurityEvent({
    category: "mutation",
    action: "confirm_assistant_coach_hypothesis",
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "assistant_coach_hypothesis",
    resourceId: hypothesisId,
    result: "success",
    metadata: { playerId: player.id, developmentThreadId: threadId },
  });

  revalidatePath(`/o/${orgSlug}/players/${player.id}`);
  return { success: true };
}

/** Dismisses a hypothesis without acting on it -- no canonical write occurs. */
export async function dismissAssistantCoachHypothesisAction(orgSlug: string, hypothesisId: string): Promise<AssistantCoachActionResult> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const hypothesis = await db.assistantCoachHypothesis.findFirst({
    where: { id: hypothesisId, organisationId: ctx.organisationId, state: "ACTIVE" },
    select: { id: true, run: { select: { playerId: true } } },
  });
  if (!hypothesis) {
    return { success: false, error: "This hypothesis is no longer available." };
  }

  await db.assistantCoachHypothesis.update({ where: { id: hypothesisId }, data: { state: "DISMISSED" } });

  revalidatePath(`/o/${orgSlug}/players/${hypothesis.run.playerId}`);
  return { success: true };
}
