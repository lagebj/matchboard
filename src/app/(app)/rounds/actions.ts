'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAllDraftSelections } from "@/lib/selection/clear-draft-selection";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

export async function finalizeRoundFromListAction(formData: FormData) {
  await requireCoachAccess();
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    throw new Error("Match round ID is required.");
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

  revalidatePath("/");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);
  revalidatePath("/fixtures");

  if (!result.success) {
    return { error: result.needsOverride ? "Override reason required" : "Finalization failed" };
  }

  return { error: "" };
}

export async function clearAllDraftsAction(formData: FormData) {
  await requireCoachAccess();
  const planningPeriodId = formData.get("planningPeriodId");
  if (typeof planningPeriodId !== "string" || !planningPeriodId) {
    throw new Error("Planning period ID is required.");
  }

  await clearAllDraftSelections(planningPeriodId);

  const draftRounds = await db.matchRound.findMany({
    where: { planningPeriodId, status: "DRAFT" },
    select: { id: true },
  });
  for (const round of draftRounds) {
    try {
      await reconcileRoundAfterDraftMutation(round.id);
    } catch {
      // reconciliation failure must not block clear
    }
  }

  revalidatePath("/");
  revalidatePath("/rounds");
  revalidatePath("/fixtures");
  revalidatePath("/assistant");
}

export async function generateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    const matchRound = await db.matchRound.findUnique({ where: { id: roundId } });
    if (!matchRound) throw new Error("Round not found.");

    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");
    const { buildPersistableWarnings, persistRoundWarnings } = await import("@/lib/selection/persist-warnings");
    const { persistRoundExplanations } = await import("@/lib/selection/persist-explanations");
    const { generateRoundIssues } = await import("@/lib/selection/generate-round-issues");

    const generatedRound = await generateMatchRound(roundId);
    await createGeneratedDraftRound(generatedRound);
    await persistRoundExplanations(generatedRound);

    const fullRound = await db.matchRound.findUniqueOrThrow({
      where: { id: roundId },
      include: { matches: { include: { team: { select: { id: true, name: true } } } } },
    });

    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const match of fullRound.matches) {
      matchIdByTeamName.set(match.team.name, match.id);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }

    const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
    await persistRoundWarnings(warnings);
    await generateRoundIssues(roundId);
    await reconcileRoundAfterDraftMutation(roundId);

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);
    revalidatePath("/fixtures");
    revalidatePath("/assistant");

    redirect(buildPathWithSearch(`/rounds/${roundId}`, { saved: "generated" }));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Generation failed." };
  }
}

export async function populateAllAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const planningPeriodId = formData.get("planningPeriodId");
    if (typeof planningPeriodId !== "string" || !planningPeriodId) {
      throw new Error("Planning period ID is required.");
    }

    const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
    await populateAllDrafts(planningPeriodId);

    revalidatePath("/");
    revalidatePath("/rounds");

    redirect(buildPathWithSearch("/rounds", { saved: "populated" }));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Populate all failed." };
  }
}

export async function regenerateAllDraftsAction(prevState: { error: string; result?: string }, formData: FormData): Promise<{ error: string; result?: string }> {
  await requireCoachAccess();
  try {
    const planningPeriodId = formData.get("planningPeriodId");
    if (typeof planningPeriodId !== "string" || !planningPeriodId) {
      throw new Error("Planning period ID is required.");
    }

    const { refreshDraftRound } = await import("@/lib/selection/refresh-draft-selection");
    const db = (await import("@/lib/db")).db;

    const rounds = await db.matchRound.findMany({
      where: { planningPeriodId, status: "DRAFT" },
      select: { id: true, name: true },
    });

    let regenerated = 0;
    let preserved = 0;
    const errors: string[] = [];

    for (const round of rounds) {
      try {
        const result = await refreshDraftRound(round.id);
        if (result.preservedManualDraft) {
          preserved++;
        } else {
          regenerated++;
        }
        try {
          await reconcileRoundAfterDraftMutation(round.id);
        } catch {
          // reconciliation failure must not block regeneration
        }
      } catch (err) {
        errors.push(`${round.name}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    revalidatePath("/");
    revalidatePath("/rounds");

    const summary = `Regenerated ${regenerated} round${regenerated !== 1 ? "s" : ""}. ${preserved} round${preserved !== 1 ? "s" : ""} had manual edits preserved.${errors.length > 0 ? ` Errors: ${errors.join("; ")}` : ""}`;
    return { error: "", result: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regenerate all failed.", result: undefined };
  }
}

export async function unfinalizeRoundFromListAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

    const { unfinalizeMatchRound } = await import("@/lib/selection/unfinalize-match-round");
    const result = await unfinalizeMatchRound(matchRoundId);

    try {
      await reconcileRoundAfterDraftMutation(matchRoundId);
    } catch {
      // reconciliation failure must not block unfinalize
    }
    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${matchRoundId}`);
    revalidatePath("/fixtures");
    revalidatePath("/assistant");

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalize failed." };
  }
}

export async function regroupRoundsAction(): Promise<{ error: string; result?: string }> {
  await requireCoachAccess();
  try {
    const { regroupMatchesIntoIsoWeekRounds } = await import("@/lib/selection/regroup-matches-into-iso-weeks");
    const result = await regroupMatchesIntoIsoWeekRounds();

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath("/fixtures");

    const summary = `Merged ${result.roundsMerged} week groups, moved ${result.matchesMoved} matches, removed ${result.roundsRemoved} duplicate rounds. All rounds now use ISO week grouping.`;
    return { error: "", result: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regroup failed." };
  }
}