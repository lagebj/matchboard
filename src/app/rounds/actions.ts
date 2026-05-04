'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAllDraftSelections } from "@/lib/selection/clear-draft-selection";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

export async function clearAllDraftsAction(formData: FormData) {
  const planningPeriodId = formData.get("planningPeriodId");
  if (typeof planningPeriodId !== "string" || !planningPeriodId) {
    throw new Error("Planning period ID is required.");
  }

  await clearAllDraftSelections(planningPeriodId);

  revalidatePath("/");
  revalidatePath("/rounds");
}

export async function generateRoundAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
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

    const generatedRound = await generateMatchRound(roundId);
    await createGeneratedDraftRound(generatedRound);

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

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath(`/rounds/${roundId}`);

    redirect(buildPathWithSearch(`/rounds/${roundId}`, { saved: "generated" }));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: error instanceof Error ? error.message : "Generation failed." };
  }
}

export async function populateAllAction(prevState: { error: string }, formData: FormData): Promise<{ error: string }> {
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

export async function regroupRoundsAction(): Promise<{ error: string; result?: string }> {
  try {
    const { regroupMatchesIntoIsoWeekRounds } = await import("@/lib/selection/regroup-matches-into-iso-weeks");
    const result = await regroupMatchesIntoIsoWeekRounds();

    revalidatePath("/");
    revalidatePath("/rounds");
    revalidatePath("/matches");

    const summary = `Merged ${result.roundsMerged} week groups, moved ${result.matchesMoved} matches, removed ${result.roundsRemoved} duplicate rounds. All rounds now use ISO week grouping.`;
    return { error: "", result: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Regroup failed." };
  }
}