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
      queryParams.error = "Override reason required: provide a reason to finalize despite Blocked conditions.";
    } else {
      queryParams.error = "Finalization failed.";
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

  revalidatePath("/");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);
}

export async function clearMatchDraftAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  await clearMatchDraftSelection(matchId);

  revalidatePath("/");
  revalidatePath("/rounds");
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

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${matchRoundId}`);

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
      return { error: result.needsOverride ? "Override reason required" : "Finalization failed" };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finalization failed." };
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

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${matchRoundId}`);
    revalidatePath("/fixtures");

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalize failed." };
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

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);
    revalidatePath("/fixtures");
    revalidatePath(`/matches/${matchId}`);

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalize failed." };
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