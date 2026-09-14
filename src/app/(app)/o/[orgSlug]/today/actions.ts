"use server";

/**
 * Today inline selection-recommendation mutation (ADR-0141,
 * `03_DATA_AND_RECOMMENDATION_CONTRACT.md` "Inline mutation"). Never trusts reason text, counts,
 * availability or team state from the client — every submitted field is re-verified by rebuilding
 * the current recommendation plan from current DB state and requiring an exact match before the
 * canonical `addPlayerToDraftMatch()` mutation owner runs. Today is never a weaker authorization
 * path than Round Board: it reuses the exact same actor/tenant/group-access checks as
 * `draft-selection-actions.ts`.
 */

import { revalidatePath } from "next/cache";
import { SelectionRole } from "@/generated/prisma/client";
import {
  requirePageActorContext,
  requireMutationRole,
  requireMatchGroupAccess,
  requirePlayerGroupAccess,
} from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import { addPlayerToDraftMatch } from "@/lib/selection/manual-draft-edit";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { getTodaySelectionRecommendations } from "@/lib/touchline/get-today-selection-recommendations";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";

export type ApplyTodaySelectionRecommendationInput = {
  orgSlug: string;
  playerId: string;
  targetMatchId: string;
  role: "CORE" | "SUPPORT" | "DEVELOPMENT";
  recommendationFingerprint: string;
};

export type ApplyTodaySelectionRecommendationResult = {
  success: boolean;
  message: string;
};

const STALE_MESSAGE = "The round changed. Review the updated recommendation.";

export async function applyTodaySelectionRecommendationAction(
  input: ApplyTodaySelectionRecommendationInput,
): Promise<ApplyTodaySelectionRecommendationResult> {
  const ctx = await requirePageActorContext(input.orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const match = await db.match.findFirst({
    where: { id: input.targetMatchId, ...ctx.orgFilter.filter },
    select: { id: true, matchRoundId: true },
  });
  if (!match) {
    return { success: false, message: "Match not found or access denied." };
  }

  await requireMatchGroupAccess(ctx, input.targetMatchId);
  await requirePlayerGroupAccess(ctx, input.playerId);

  // Rebuild the current recommendation plan from current DB state — never trust the client's
  // reason text, counts, availability or team state.
  const roundPlanIntegrity = await computeRoundPlanIntegrity(match.matchRoundId);
  const decisions = await getTodaySelectionRecommendations(
    ctx.organisationId,
    { [match.matchRoundId]: roundPlanIntegrity },
    input.orgSlug,
    [],
  );

  const currentDecision = decisions.find((d) => d.playerId === input.playerId);
  const recommendation = currentDecision?.recommendation;

  const matches =
    recommendation != null &&
    recommendation.directlyActionable &&
    recommendation.targetMatchId === input.targetMatchId &&
    recommendation.role === input.role &&
    recommendation.fingerprint === input.recommendationFingerprint;

  if (!matches) {
    return { success: false, message: STALE_MESSAGE };
  }

  const result = await addPlayerToDraftMatch(input.targetMatchId, input.playerId, input.role as SelectionRole);

  if (!result.success) {
    return { success: false, message: result.errors.join(" ") || "Could not apply the recommendation." };
  }

  try {
    await reconcileRoundAfterDraftMutation(match.matchRoundId);
  } catch {
    // Reconciliation failure must not block the mutation — matches the existing Round Board
    // draft-selection-action behaviour.
  }

  revalidatePath(`/o/${input.orgSlug}/today`);
  revalidatePath(`/o/${input.orgSlug}/rounds/${match.matchRoundId}`);
  revalidatePath(`/o/${input.orgSlug}/fixtures`);

  return { success: true, message: `Added to ${currentDecision?.displayName ?? "the match"}.` };
}
