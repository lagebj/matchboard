'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
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
    if (result.hardBlocked) {
      queryParams.error = "Finalization blocked: resolve hard blockers before finalizing.";
    } else if (result.needsOverride) {
      queryParams.error = "Override reason required: some warnings need a manual override reason.";
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