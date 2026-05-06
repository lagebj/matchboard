'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

export async function finalizeRoundAction(formData: FormData) {
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    redirect(buildPathWithSearch(`/rounds/${matchRoundId ?? ""}`, { error: "Match round ID is required." }));
  }

  const overrideReason = formData.get("overrideReason");
  const overrideReasonStr = typeof overrideReason === "string" && overrideReason.trim() ? overrideReason.trim() : undefined;

  const result = await finalizeMatchRound(matchRoundId, overrideReasonStr);

  if (!result.success) {
    const queryParams: Record<string, string> = {};
    if (result.needsOverride) {
      queryParams.error = "Override reason required: provide a reason to finalize despite warnings.";
    } else {
      queryParams.error = "Finalization failed.";
    }
    redirect(buildPathWithSearch(`/rounds/${matchRoundId}`, queryParams));
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);

  for (const matchId of result.finalizedMatchIds) {
    revalidatePath(`/selection/${matchId}`);
  }

  redirect(buildPathWithSearch(`/rounds/${matchRoundId}`, { finalized: "1" }));
}

export async function clearRoundDraftAction(formData: FormData) {
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
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  await clearMatchDraftSelection(matchId);

  revalidatePath("/");
  revalidatePath("/rounds");
}

export async function regenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
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
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    const overrideReason = formData.get("overrideReason");
    const overrideReasonStr = typeof overrideReason === "string" && overrideReason.trim() ? overrideReason.trim() : undefined;

    const { finalizeSingleMatch } = await import("@/lib/selection/finalize-single-match");
    const result = await finalizeSingleMatch(matchId, overrideReasonStr);

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);
    revalidatePath("/matches");
    revalidatePath(`/matches/${matchId}`);

    if (!result.success) {
      return { error: result.needsOverride ? "Override reason required" : "Finalization failed" };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finalization failed." };
  }
}

export async function regenerateMatchAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
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