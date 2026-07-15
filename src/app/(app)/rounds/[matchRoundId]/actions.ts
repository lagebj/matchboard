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

export async function finalizeRoundAction(formData: FormData) {
  await requireCoachAccess();
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    redirect(buildPathWithSearch(`/rounds/${matchRoundId ?? ""}`, { error: "Match round ID is required." }));
  }

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
    const queryParams: Record<string, string> = {};
    if (result.needsOverride) {
      queryParams.error = "Override reason required: provide a reason to finalise despite Blocked conditions.";
    } else {
      queryParams.error = "Finalisation failed.";
    }
    redirect(buildPathWithSearch(`/rounds/${matchRoundId}`, queryParams));
  }

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
  await requireCoachAccess();
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    throw new Error("Match round ID is required.");
  }

  await clearRoundDraftSelection(matchRoundId);
  await reconcileAndRevalidatePaths(matchRoundId);
}

export async function clearMatchDraftAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
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
  await requireCoachAccess();
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

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
  await requireCoachAccess();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
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
  await requireCoachAccess();
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

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
  await requireCoachAccess();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
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
  await requireCoachAccess();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
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