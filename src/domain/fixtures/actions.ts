"use server";

import { getFixturesOverview } from "@/domain/fixtures/service";
import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function verifyRoundOrgAccess(roundId: string, orgFilter: { organisationId: string }) {
  const round = await db.matchRound.findFirst({
    where: { id: roundId },
    select: { organisationId: true },
  });
  if (!round || round.organisationId !== orgFilter.organisationId) {
    throw new Error("Round not found or access denied.");
  }
}

async function verifyMatchOrgAccess(matchId: string, orgFilter: { organisationId: string }) {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: { organisationId: true },
  });
  if (!match || match.organisationId !== orgFilter.organisationId) {
    throw new Error("Match not found or access denied.");
  }
}

async function verifyLeagueSeasonOrgAccess(leagueSeasonId: string, orgFilter: { organisationId: string }) {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { organisationId: true },
  });
  if (!leagueSeason || leagueSeason.organisationId !== orgFilter.organisationId) {
    throw new Error("League season not found or access denied.");
  }
}

export async function fetchFixturesOverview() {
  const ctx = await requireActorContext();
  return getFixturesOverview(ctx.orgFilter);
}

export async function fixturePopulateAllAction(prevState: { error: string; result?: string }, formData: FormData): Promise<{ error: string; result?: string }> {
  const ctx = await requireActorContext();
  try {
    const leagueSeasonId = formData.get("leagueSeasonId");
    if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
      throw new Error("League season ID is required.");
    }

    await verifyLeagueSeasonOrgAccess(leagueSeasonId, ctx.orgFilter.filter);

    const { populateAllDrafts } = await import("@/lib/selection/populate-all-drafts");
    await populateAllDrafts(leagueSeasonId);

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
  const ctx = await requireActorContext();
  try {
    const leagueSeasonId = formData.get("leagueSeasonId");
    if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
      throw new Error("League season ID is required.");
    }

    await verifyLeagueSeasonOrgAccess(leagueSeasonId, ctx.orgFilter.filter);

    const { refreshDraftRound } = await import("@/lib/selection/refresh-draft-selection");

    const rounds = await db.matchRound.findMany({
      where: { leagueSeasonId, status: "DRAFT", ...ctx.orgFilter.filter },
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
  const ctx = await requireActorContext();
  const leagueSeasonId = formData.get("leagueSeasonId");
  if (typeof leagueSeasonId !== "string" || !leagueSeasonId) {
    throw new Error("League season ID is required.");
  }

  await verifyLeagueSeasonOrgAccess(leagueSeasonId, ctx.orgFilter.filter);

  const { clearAllDraftSelections } = await import("@/lib/selection/clear-draft-selection");
  await clearAllDraftSelections(leagueSeasonId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
}

export async function fixtureGenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requireActorContext();
  const roundId = formData.get("roundId");
  if (typeof roundId !== "string" || !roundId) {
    return { error: "Round ID is required." };
  }

  await verifyRoundOrgAccess(roundId, ctx.orgFilter.filter);

  const { generateMatchRound } = await import("@/lib/selection/generate-round");
  const { createGeneratedDraftRound } = await import("@/lib/selection/save-generated-draft");
  const { buildPersistableWarnings, persistRoundWarnings } = await import("@/lib/selection/persist-warnings");
  const { persistRoundExplanations } = await import("@/lib/selection/persist-explanations");

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

  const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName, fullRound.organisationId);
  await persistRoundWarnings(warnings);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${roundId}`);

  return { error: "" };
}

export async function fixtureRegenerateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requireActorContext();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    await verifyRoundOrgAccess(roundId, ctx.orgFilter.filter);

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
  const ctx = await requireActorContext();
  const roundId = formData.get("roundId");
  if (typeof roundId !== "string" || !roundId) {
    throw new Error("Round ID is required.");
  }

  await verifyRoundOrgAccess(roundId, ctx.orgFilter.filter);

  const { clearRoundDraftSelection } = await import("@/lib/selection/clear-draft-selection");
  await clearRoundDraftSelection(roundId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${roundId}`);
}

export async function fixtureFinalizeRoundAction(prevState: { error: string; needsOverride?: boolean }, formData: FormData): Promise<{ error: string; needsOverride?: boolean }> {
  const ctx = await requireActorContext();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    await verifyRoundOrgAccess(roundId, ctx.orgFilter.filter);

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
      return { error: result.needsOverride ? "Override reason required" : "Finalisation failed", needsOverride: result.needsOverride };
    }

    return { error: "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finalisation failed." };
  }
}

export async function fixtureUnfinalizeRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requireActorContext();
  try {
    const roundId = formData.get("roundId");
    if (typeof roundId !== "string" || !roundId) {
      throw new Error("Round ID is required.");
    }

    await verifyRoundOrgAccess(roundId, ctx.orgFilter.filter);

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
    return { error: error instanceof Error ? error.message : "Un-finalise failed." };
  }
}

export async function fixtureRegenerateMatchAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
  const ctx = await requireActorContext();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    await verifyMatchOrgAccess(matchId, ctx.orgFilter.filter);

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
  const ctx = await requireActorContext();
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  await verifyMatchOrgAccess(matchId, ctx.orgFilter.filter);

  const { clearMatchDraftSelection } = await import("@/lib/selection/clear-draft-selection");
  await clearMatchDraftSelection(matchId);

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
}

export async function fixtureFinalizeMatchAction(prevState: { error: string; needsOverride?: boolean }, formData: FormData): Promise<{ error: string; needsOverride?: boolean }> {
  const ctx = await requireActorContext();
  try {
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      throw new Error("Match ID is required.");
    }

    await verifyMatchOrgAccess(matchId, ctx.orgFilter.filter);

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