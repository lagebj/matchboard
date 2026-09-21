"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createThread, addObservation } from "@/lib/planned-rotation/development-thread";
import { logSecurityEvent } from "@/lib/security/audit-log";

export type AiInsightActionResult = { success: true } | { success: false; error: string };

// The AI's `suggestedAction.category`/`observation` are free-text provider output
// (`contracts.ts`'s `confirmDevelopmentObservationActionSchema`), not the coach-authored
// `DevelopmentFocusCategory` enum `createThread()` expects for its own `category` field — so the
// category is used as the new thread's human-readable `focus` label instead of being force-fit
// into that enum. `evidence` is capped to the development-thread module's own 1000-character
// limit (the AI contract allows up to 2000).
const MAX_EVIDENCE_LENGTH = 1000;

/**
 * "Confirm as development observation" (08_UI_UX_SPEC.md "Completed match" /
 * 01_LOCKED_DECISIONS.md #15: "An AI-proposed development observation becomes canonical only
 * after explicit coach confirmation through the existing development/evidence workflow.").
 *
 * Writes through the same `createThread`/`addObservation` path a coach uses when manually
 * starting a development thread (`development-thread-actions.ts`) — chosen over the "capture
 * first, classify later" quick-observation path because the AI has already supplied a specific
 * player + focus + evidence triple; there is nothing left to classify. Always starts a *new*
 * thread rather than attempting to match an existing one, since the AI's `category` text has no
 * reliable mapping onto an existing thread's identity.
 */
export async function confirmAiDevelopmentSuggestionAction(
  orgSlug: string,
  insightId: string,
): Promise<AiInsightActionResult> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const insight = await db.aiAdvisorInsight.findFirst({
    where: { id: insightId, organisationId: ctx.organisationId, state: "ACTIVE", actionType: "CONFIRM_DEVELOPMENT_OBSERVATION" },
    include: { review: { select: { scopeType: true, scopeId: true } } },
  });
  if (!insight || insight.review.scopeType !== "MATCH" || !insight.actionPayload) {
    return { success: false, error: "This suggestion is no longer available." };
  }

  await requireMatchGroupAccess(ctx, insight.review.scopeId);

  const payload = insight.actionPayload as { playerId: string; category: string; observation: string };

  const player = await db.player.findFirst({ where: { id: payload.playerId, organisationId: ctx.organisationId }, select: { id: true } });
  if (!player) return { success: false, error: "Player not found." };

  try {
    const thread = await createThread(
      { playerId: payload.playerId, focus: payload.category, rationale: "Suggested by AI Advisor.", recordedBy: ctx.email },
      ctx.orgFilter,
    );
    await addObservation(
      {
        threadId: thread.id,
        matchId: insight.review.scopeId,
        evidence: payload.observation.slice(0, MAX_EVIDENCE_LENGTH),
        context: "Confirmed from an AI Advisor suggestion.",
        recordedBy: ctx.email,
      },
      ctx.orgFilter,
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not confirm this suggestion." };
  }

  await db.aiAdvisorInsight.update({ where: { id: insightId }, data: { state: "ACCEPTED" } });

  logSecurityEvent({
    category: "mutation",
    action: "confirm_ai_development_suggestion",
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "ai_advisor_insight",
    resourceId: insightId,
    result: "success",
    metadata: { playerId: payload.playerId, matchId: insight.review.scopeId },
  });

  revalidatePath(`/o/${orgSlug}/matches/${insight.review.scopeId}`);
  return { success: true };
}

/** Dismisses an AI Advisor insight (currently only exposed for development-suggestion insights
 * on the completed-match panel) without acting on it — no canonical write occurs. */
export async function dismissAiInsightAction(orgSlug: string, insightId: string): Promise<AiInsightActionResult> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const insight = await db.aiAdvisorInsight.findFirst({
    where: { id: insightId, organisationId: ctx.organisationId, state: "ACTIVE" },
    include: { review: { select: { scopeType: true, scopeId: true } } },
  });
  if (!insight || insight.review.scopeType !== "MATCH") {
    return { success: false, error: "This suggestion is no longer available." };
  }

  await requireMatchGroupAccess(ctx, insight.review.scopeId);

  await db.aiAdvisorInsight.update({ where: { id: insightId }, data: { state: "DISMISSED" } });

  logSecurityEvent({
    category: "mutation",
    action: "dismiss_ai_insight",
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "ai_advisor_insight",
    resourceId: insightId,
    result: "success",
  });

  revalidatePath(`/o/${orgSlug}/matches/${insight.review.scopeId}`);
  return { success: true };
}
