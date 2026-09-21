"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createThread, addObservation } from "@/lib/planned-rotation/development-thread";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { parseWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";

export type AiInsightActionResult = { success: true } | { success: false; error: string };

// Same free-text-category-as-thread-focus choice, and the same 1000-character evidence cap, as
// the completed-match panel's confirm action (`matches/[matchId]/ai-insight-actions.ts`) — see
// that file's comment for the full rationale.
const MAX_EVIDENCE_LENGTH = 1000;

/**
 * "Confirm as development observation" for a `weekly_team_review` suggestion
 * (08_UI_UX_SPEC.md "Weekly review" / 01_LOCKED_DECISIONS.md #15). Mirrors
 * `matches/[matchId]/ai-insight-actions.ts`'s confirm action, adapted for the `TEAM_WEEK` scope:
 * the insight's own `scopeId` (`teamId:weekKey`) is parsed to recover `teamId` for both the
 * access check and the revalidated path, and no `matchId` is passed to `addObservation()` (it is
 * optional) since a weekly review is not scoped to any single match.
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
  if (!insight || insight.review.scopeType !== "TEAM_WEEK" || !insight.actionPayload) {
    return { success: false, error: "This suggestion is no longer available." };
  }

  const parsedScope = parseWeeklyTeamReviewScopeId(insight.review.scopeId);
  if (!parsedScope) {
    return { success: false, error: "This suggestion is no longer available." };
  }

  await requireTeamGroupAccess(ctx, parsedScope.teamId);

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
    metadata: { playerId: payload.playerId, teamId: parsedScope.teamId, weekKey: parsedScope.weekKey },
  });

  revalidatePath(`/o/${orgSlug}/teams/${parsedScope.teamId}/review`);
  return { success: true };
}

/** Dismisses a `weekly_team_review` Advisor insight without acting on it — no canonical write
 * occurs. Mirrors `matches/[matchId]/ai-insight-actions.ts`'s dismiss action for the
 * `TEAM_WEEK` scope. */
export async function dismissAiInsightAction(orgSlug: string, insightId: string): Promise<AiInsightActionResult> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const insight = await db.aiAdvisorInsight.findFirst({
    where: { id: insightId, organisationId: ctx.organisationId, state: "ACTIVE" },
    include: { review: { select: { scopeType: true, scopeId: true } } },
  });
  if (!insight || insight.review.scopeType !== "TEAM_WEEK") {
    return { success: false, error: "This suggestion is no longer available." };
  }

  const parsedScope = parseWeeklyTeamReviewScopeId(insight.review.scopeId);
  if (!parsedScope) {
    return { success: false, error: "This suggestion is no longer available." };
  }

  await requireTeamGroupAccess(ctx, parsedScope.teamId);

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

  revalidatePath(`/o/${orgSlug}/teams/${parsedScope.teamId}/review`);
  return { success: true };
}
