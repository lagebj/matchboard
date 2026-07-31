'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";
import { clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";
import { requireCoachAccess } from "@/lib/auth";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { logFinalization, logManualOverride } from "@/lib/security/audit-log";
import { db } from "@/lib/db";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";

async function reconcileAndRevalidatePaths(matchRoundId: string, extraPaths: string[] = []) {
  try {
    await reconcileRoundAfterDraftMutation(matchRoundId);
  } catch {
    // reconciliation failure must not block the mutation
  }
  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);
  revalidatePath("/assistant");
  for (const path of extraPaths) {
    revalidatePath(path);
  }
}

async function verifyRoundAccess(matchRoundId: string, orgFilter: { type: "org"; organisationId: string } | { type: "unscoped"; filter: {}; filterNullable: {} }): Promise<void> {
  if (orgFilter.type !== "org") return;
  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId, organisationId: orgFilter.organisationId },
    select: { id: true },
  });
  if (!round) throw new Error("Round not found or access denied.");
}

export async function finalizeRoundAction(formData: FormData) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    redirect(buildPathWithSearch(`/rounds/${matchRoundId ?? ""}`, { error: "Match round ID is required." }));
  }

  await verifyRoundAccess(matchRoundId, orgFilter);

  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");

  const category: OverrideReasonCategory | undefined = typeof overrideReasonCategory === "string" && overrideReasonCategory.trim() && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory.trim() as OverrideReasonCategory)
    ? (overrideReasonCategory.trim() as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim()
    ? overrideReasonDetail.trim()
    : undefined;

  const result = await finalizeMatchRound(matchRoundId, category, detail);

  if (!result.success) {
    if (category && result.needsOverride) {
      logManualOverride(coach.email ?? "unknown", "round", matchRoundId, category);
    }
    const queryParams: Record<string, string> = {};
    if (result.needsOverride) {
      queryParams.error = "Override reason required: provide a reason to finalise despite Blocked conditions.";
    } else {
      queryParams.error = "Finalisation failed.";
    }
    redirect(buildPathWithSearch(`/rounds/${matchRoundId}`, queryParams));
  }

  logFinalization(coach.email ?? "unknown", "round", matchRoundId, "success", category ? `override: ${category}` : undefined);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);

  for (const matchId of result.finalizedMatchIds) {
    revalidatePath(`/selection/${matchId}`);
  }

  redirect(buildPathWithSearch(`/rounds/${matchRoundId}`, { finalized: "1" }));
}

export async function clearRoundDraftAction(formData: FormData) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    throw new Error("Match round ID is required.");
  }

  await verifyRoundAccess(matchRoundId, orgFilter);

  await clearRoundDraftSelection(matchRoundId);
  await reconcileAndRevalidatePaths(matchRoundId);
}

export async function clearMatchDraftAction(formData: FormData) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const matchId = formData.get("matchId");
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  if (orgFilter.type === "org") {
    const match = await db.match.findFirst({
      where: { id: matchId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!match) {
      throw new Error("Match not found or access denied.");
    }
  }

  await clearMatchDraftSelection(matchId);
  
  if (typeof matchRoundId === "string" && matchRoundId) {
    await reconcileAndRevalidatePaths(matchRoundId);
  } else {
    revalidatePath("/");
    revalidatePath("/rounds");
  }
}

export async function regenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

    await verifyRoundAccess(matchRoundId, orgFilter);

    const result = await refreshDraftRound(matchRoundId);

    if (result.preservedManualDraft) {
      return { error: "Round has manual edits that were preserved. Clear manual edits first to fully regenerate." };
    }

    await reconcileAndRevalidatePaths(matchRoundId);

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}

export async function finalizeSingleMatchFromBoardAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    if (orgFilter.type === "org") {
      const match = await db.match.findFirst({
        where: { id: matchId, ...orgFilter.filter },
        select: { id: true },
      });
      if (!match) {
        throw new Error("Match not found or access denied.");
      }
    }

    const overrideReasonCategory = formData.get("overrideReasonCategory");
    const overrideReasonDetail = formData.get("overrideReasonDetail");

    const category: OverrideReasonCategory | undefined = typeof overrideReasonCategory === "string" && overrideReasonCategory.trim() && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory.trim() as OverrideReasonCategory)
      ? (overrideReasonCategory.trim() as OverrideReasonCategory)
      : undefined;
    const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim()
      ? overrideReasonDetail.trim()
      : undefined;

    const result = await finalizeSingleMatch(matchId, category, detail);

    if (result.success) {
      logFinalization(coach.email ?? "unknown", "match", matchId, "success", category ? `override: ${category}` : undefined);
    } else if (category && result.needsOverride) {
      logManualOverride(coach.email ?? "unknown", "match", matchId, category);
    }

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);
    revalidatePath("/fixtures");
    revalidatePath(`/matches/${matchId}`);

    if (!result.success) {
      return { error: result.needsOverride ? "Override reason required" : "Finalisation failed" };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finalisation failed." };
  }
}

export async function unfinalizeRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

    await verifyRoundAccess(matchRoundId, orgFilter);

    const { unfinalizeMatchRound } = await import("@/lib/selection/unfinalize-match-round");
    const result = await unfinalizeMatchRound(matchRoundId);

    await reconcileAndRevalidatePaths(matchRoundId);

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalise failed." };
  }
}

export async function unfinalizeSingleMatchFromBoardAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    if (orgFilter.type === "org") {
      const match = await db.match.findFirst({
        where: { id: matchId, ...orgFilter.filter },
        select: { id: true },
      });
      if (!match) {
        throw new Error("Match not found or access denied.");
      }
    }

    const { unfinalizeSingleMatch } = await import("@/lib/selection/unfinalize-single-match");
    const result = await unfinalizeSingleMatch(matchId);

    const roundId = typeof formData.get("matchRoundId") === "string" ? formData.get("matchRoundId") as string : "";
    if (roundId) {
      await reconcileAndRevalidatePaths(roundId, [`/matches/${matchId}`]);
    } else {
      revalidatePath("/");
      revalidatePath("/rounds");
      revalidatePath("/fixtures");
      revalidatePath(`/matches/${matchId}`);
    }

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalise failed." };
  }
}

export async function regenerateMatchAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    if (orgFilter.type === "org") {
      const match = await db.match.findFirst({
        where: { id: matchId, ...orgFilter.filter },
        select: { id: true },
      });
      if (!match) {
        throw new Error("Match not found or access denied.");
      }
    }

    const { refreshDraftSelection } = await import("@/lib/selection/refresh-draft-selection");
    const result = await refreshDraftSelection(matchId);

    if (result.preservedManualDraft) {
      return { error: "Match has manual edits that were preserved. Clear manual edits first to fully regenerate." };
    }

    revalidatePath("/");
    revalidatePath("/rounds");

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}