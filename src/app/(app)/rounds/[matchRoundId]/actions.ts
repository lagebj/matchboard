'use server'

import { revalidatePath } from "next/cache";
import { clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { db } from "@/lib/db";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

async function reconcileAndRevalidatePaths(organisationSlug: string, matchRoundId: string, extraPaths: string[] = []) {
  try {
    await reconcileRoundAfterDraftMutation(matchRoundId);
  } catch {
    // reconciliation failure must not block the mutation
  }
  revalidatePath(`/o/${organisationSlug}/today`);
  revalidatePath(`/o/${organisationSlug}/fixtures`);
  revalidatePath(`/o/${organisationSlug}/rounds`);
  revalidatePath(`/o/${organisationSlug}/rounds/${matchRoundId}`);
  for (const path of extraPaths) {
    revalidatePath(path);
  }
}

import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

async function verifyRoundAccess(matchRoundId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId, organisationId: orgFilter.organisationId },
    select: { id: true },
  });
  if (!round) throw new Error("Round not found or access denied.");
}

export async function clearRoundDraftAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    throw new Error("Match round ID is required.");
  }

  await verifyRoundAccess(matchRoundId, ctx.orgFilter);

  await clearRoundDraftSelection(matchRoundId);
  await reconcileAndRevalidatePaths(ctx.organisationSlug, matchRoundId);
}

export async function clearMatchDraftAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const matchId = formData.get("matchId");
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!match) {
    throw new Error("Match not found or access denied.");
  }


  await clearMatchDraftSelection(matchId);

  if (typeof matchRoundId === "string" && matchRoundId) {
    await reconcileAndRevalidatePaths(ctx.organisationSlug, matchRoundId);
  } else {
    revalidatePath(`/o/${ctx.organisationSlug}/today`);
    revalidatePath(`/o/${ctx.organisationSlug}/rounds`);
  }
}

export async function regenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

    await verifyRoundAccess(matchRoundId, ctx.orgFilter);

    const result = await refreshDraftRound(matchRoundId);

    if (result.preservedManualDraft) {
      return { error: "Round has manual edits that were preserved. Clear manual edits first to fully regenerate." };
    }

    await reconcileAndRevalidatePaths(ctx.organisationSlug, matchRoundId);

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}

export async function regenerateMatchAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!match) {
      throw new Error("Match not found or access denied.");
    }

    const { refreshDraftSelection } = await import("@/lib/selection/refresh-draft-selection");
    const result = await refreshDraftSelection(matchId);

    if (result.preservedManualDraft) {
      return { error: "Match has manual edits that were preserved. Clear manual edits first to fully regenerate." };
    }

    revalidatePath(`/o/${ctx.organisationSlug}/today`);
    revalidatePath(`/o/${ctx.organisationSlug}/rounds`);

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}
