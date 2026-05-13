"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getFixturesOverview } from "@/domain/fixtures/service";
import { revalidatePath } from "next/cache";

export async function fetchFixturesOverview() {
  await requireCoachAccess();
  return getFixturesOverview();
}

export async function fixturePopulateAllAction(prevState: { error: string; result?: string }, formData: FormData): Promise<{ error: string; result?: string }> {
  await requireCoachAccess();
  try {
    const planningPeriodId = formData.get("planningPeriodId");
    if (typeof planningPeriodId !== "string" || !planningPeriodId) {
      throw new Error("Planning period ID is required.");
    }

    const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
    await populateAllDrafts(planningPeriodId);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");

    return { error: "", result: "All rounds populated." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Populate all failed.", result: undefined };
  }
}

export async function fixtureRegenerateAllAction(prevState: { error: string; result?: string }, formData: FormData): Promise<{ error: string; result?: string }> {
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
      } catch (err) {
        errors.push(`${round.name}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");

    const summary = `Regenerated ${regenerated} round${regenerated !== 1 ? "s" : ""}. ${preserved} round${preserved !== 1 ? "s" : ""} had manual edits preserved.${errors.length > 0 ? ` Errors: ${errors.join("; ")}` : ""}`;
    return { error: "", result: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regenerate all failed.", result: undefined };
  }
}

export async function fixtureClearAllDraftsAction(formData: FormData) {
  await requireCoachAccess();
  const planningPeriodId = formData.get("planningPeriodId");
  if (typeof planningPeriodId !== "string" || !planningPeriodId) {
    throw new Error("Planning period ID is required.");
  }

  const { clearAllDraftSelections } = await import("@/lib/selection/clear-draft-selection");
  await clearAllDraftSelections(planningPeriodId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
}

export async function fixtureGenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  const roundId = formData.get("roundId");
  if (typeof roundId !== "string" || !roundId) {
    return { error: "Round ID is required." };
  }

  const { generateMatchRound } = await import("@/lib/selection/generate-round");
  const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");
  const { buildPersistableWarnings, persistRoundWarnings } = await import("@/lib/selection/persist-warnings");
  const { persistRoundExplanations } = await import("@/lib/selection/persist-explanations");
  const { generateRoundIssues } = await import("@/lib/selection/generate-round-issues");
  const db = (await import("@/lib/db")).db;

  const generatedRound = await generateMatchRound(roundId);
  await createGeneratedDraftRound(generatedRound);
  await persistRoundExplanations(generatedRound);

  const fullRound = await db.matchRound.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          team: {
            select: { id: true, name: true },
          },
        },
      },
    },
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

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${roundId}`);

  return { error: "" };
}

export async function fixtureRegenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    const { refreshDraftRound } = await import("@/lib/selection/refresh-draft-selection");
    const result = await refreshDraftRound(roundId);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);

    if (result.preservedManualDraft) {
      return { error: "Round has manual edits preserved. Clear manual edits first to fully regenerate." };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}

export async function fixtureClearRoundDraftAction(formData: FormData) {
  await requireCoachAccess();
  const roundId = formData.get("roundId");
  if (typeof roundId !== "string" || !roundId) {
    throw new Error("Round ID is required.");
  }

  const { clearRoundDraftSelection } = await import("@/lib/selection/clear-draft-selection");
  await clearRoundDraftSelection(roundId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${roundId}`);
}

export async function fixtureFinalizeRoundAction(prevState: { error: string; needsOverride?: boolean }, formData: FormData): Promise<{ error: string; needsOverride?: boolean }> {
  await requireCoachAccess();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    const overrideReasonCategory = formData.get("overrideReasonCategory") as string | null;
    const overrideReasonDetail = formData.get("overrideReasonDetail") as string | null;

    const { finalizeMatchRound } = await import("@/lib/selection/finalize-match-round");
    const { OVERRIDE_REASON_CATEGORIES } = await import("@/lib/selection/types");

    const category = overrideReasonCategory && overrideReasonCategory.trim() && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory.trim() as import("@/lib/selection/types").OverrideReasonCategory)
      ? (overrideReasonCategory.trim() as import("@/lib/selection/types").OverrideReasonCategory)
      : undefined;
    const detail = overrideReasonDetail && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

    const result = await finalizeMatchRound(roundId, category, detail);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);

    if (!result.success) {
      return { error: result.needsOverride ? "Override reason required" : "Finalization failed", needsOverride: result.needsOverride };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finalization failed." };
  }
}

export async function fixtureUnfinalizeRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    const { unfinalizeMatchRound } = await import("@/lib/selection/unfinalize-match-round");
    const result = await unfinalizeMatchRound(roundId);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalize failed." };
  }
}

export async function fixtureRegenerateMatchAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  await requireCoachAccess();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    const { refreshDraftSelection } = await import("@/lib/selection/refresh-draft-selection");
    const result = await refreshDraftSelection(matchId);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");

    if (result.preservedManualDraft) {
      return { error: "Match has manual edits preserved. Clear manual edits first to fully regenerate." };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regeneration failed." };
  }
}

export async function fixtureClearMatchDraftAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  const { clearMatchDraftSelection } = await import("@/lib/selection/clear-draft-selection");
  await clearMatchDraftSelection(matchId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
}

export async function fixtureFinalizeMatchAction(prevState: { error: string; needsOverride?: boolean }, formData: FormData): Promise<{ error: string; needsOverride?: boolean }> {
  await requireCoachAccess();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    const overrideReasonCategory = formData.get("overrideReasonCategory") as string | null;
    const overrideReasonDetail = formData.get("overrideReasonDetail") as string | null;

    const { finalizeSingleMatch } = await import("@/lib/selection/finalize-single-match");
    const { OVERRIDE_REASON_CATEGORIES } = await import("@/lib/selection/types");

    const category = overrideReasonCategory && overrideReasonCategory.trim() && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory.trim() as import("@/lib/selection/types").OverrideReasonCategory)
      ? (overrideReasonCategory.trim() as import("@/lib/selection/types").OverrideReasonCategory)
      : undefined;
    const detail = overrideReasonDetail && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

    const result = await finalizeSingleMatch(matchId, category, detail);

    revalidatePath("/");
    revalidatePath("/fixtures");
    revalidatePath("/rounds");

    if (!result.success) {
      return { error: result.needsOverride ? "Override reason required" : "Match finalization failed", needsOverride: result.needsOverride };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Match finalization failed." };
  }
}