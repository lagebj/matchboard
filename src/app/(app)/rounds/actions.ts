'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAllDraftSelections } from "@/lib/selection/clear-draft-selection";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

export async function finalizeRoundFromListAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  const matchRoundId = formData.get("matchRoundId");
  if (typeof matchRoundId !== "string" || !matchRoundId) {
    throw new Error("Match round ID is required.");
  }

  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!round) {
    throw new Error("Round not found or access denied.");
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
    return { error: result.needsOverride ? "Override reason required" : "Finalisation failed" };
  }

  return { error: "" };
}

export async function clearAllDraftsAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  const leagueSeasonId = formData.get("leagueSeasonId");
  if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
    throw new Error("League season ID is required.");
  }

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!leagueSeason) {
    throw new Error("League season not found or access denied.");
  }


  await clearAllDraftSelections(leagueSeasonId);

  const draftRounds = await db.matchRound.findMany({
    where: { leagueSeasonId, status: "DRAFT" },
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
  revalidatePath("/today");
}

export async function generateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    const matchRound = await db.matchRound.findFirst({
      where: { id: roundId, ...ctx.orgFilter.filter },
      select: { id: true, organisationId: true },
    });
    if (!matchRound) throw new Error("Round not found or access denied.");

    const { generateMatchRound } = await import("@/lib/selection/generate-round");
    const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");
    const { buildPersistableWarnings, persistRoundWarnings } = await import("@/lib/selection/persist-warnings");
    const { persistRoundExplanations } = await import("@/lib/selection/persist-explanations");

    const generatedRound = await generateMatchRound(roundId);
    await createGeneratedDraftRound(generatedRound);
    await persistRoundExplanations(generatedRound);

    const fullRound = await db.matchRound.findFirstOrThrow({
      where: { id: roundId, ...ctx.orgFilter.filter },
      include: { matches: { include: { team: { select: { id: true, name: true } } } } },
    });

    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const match of fullRound.matches) {
      matchIdByTeamName.set(match.team.name, match.id);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }

    const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName, matchRound.organisationId);
    await persistRoundWarnings(warnings);
    await reconcileRoundAfterDraftMutation(roundId);

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);
    revalidatePath("/fixtures");
    revalidatePath("/today");

    redirect(buildPathWithSearch(`/rounds/${roundId}`, { saved: "generated" }));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Generation failed." };
  }
}

export async function populateAllAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  try {
    const leagueSeasonId = formData.get("leagueSeasonId");
    if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
      throw new Error("League season ID is required.");
    }

    const leagueSeason = await db.leagueSeason.findFirst({
      where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!leagueSeason) {
      throw new Error("League season not found or access denied.");
    }

    const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
    await populateAllDrafts(leagueSeasonId);

    revalidatePath("/");
    revalidatePath("/rounds");

    redirect(buildPathWithSearch("/rounds", { saved: "populated" }));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Populate all failed." };
  }
}

export async function regenerateAllDraftsAction(prevState: { error: string; result?: string }, formData: FormData): Promise<{ error: string; result?: string }> {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  try {
    const leagueSeasonId = formData.get("leagueSeasonId");
    if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
      throw new Error("League season ID is required.");
    }

    const leagueSeason = await db.leagueSeason.findFirst({
      where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!leagueSeason) {
      throw new Error("League season not found or access denied.");
    }

    const { refreshDraftRound } = await import("@/lib/selection/refresh-draft-selection");

    const rounds = await db.matchRound.findMany({
      where: { leagueSeasonId, status: "DRAFT" },
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
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);
  try {
    const matchRoundId = formData.get("matchRoundId");
    if (typeof matchRoundId !== "string" || !matchRoundId) {
      throw new Error("Match round ID is required.");
    }

    const round = await db.matchRound.findFirst({
      where: { id: matchRoundId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!round) {
      throw new Error("Round not found or access denied.");
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
    revalidatePath("/today");

    if (!result.success) {
      return { error: result.message };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Un-finalise failed." };
  }
}

export async function regroupRoundsAction(): Promise<{ error: string; result?: string }> {
  const ctx = await requirePageActorContext();
  requireMutationRole(ctx);

  try {
    const { regroupMatchesIntoIsoWeekRounds } = await import("@/lib/selection/regroup-matches-into-iso-weeks");
    const result = await regroupMatchesIntoIsoWeekRounds(ctx.orgFilter.organisationId);

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath("/fixtures");

    const summary = `Merged ${result.roundsMerged} week groups, moved ${result.matchesMoved} matches, removed ${result.roundsRemoved} duplicate rounds. All rounds now use ISO week grouping.`;
    return { error: "", result: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regroup failed." };
  }
}