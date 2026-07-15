'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  type MatchdayResponsibilityType,
  MATCHDAY_RESPONSIBILITIES,
} from "@/lib/coaching/types";
import { enrichExplanation } from "@/lib/selection/explanation-enrichment";

export async function setMatchdayResponsibilityAction(
  selectionId: string,
  responsibility: string | null,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  if (responsibility !== null && !MATCHDAY_RESPONSIBILITIES.includes(responsibility as MatchdayResponsibilityType)) {
    return { success: false, error: `Invalid matchday responsibility: ${responsibility}` };
  }

  try {
    const selection = await db.selection.findUnique({
      where: { id: selectionId },
      select: { id: true, matchId: true, status: true, matchdayResponsibility: true },
    });

    if (!selection) return { success: false, error: "Selection not found." };
    if (selection.status === "FINALIZED") {
      return { success: false, error: "Cannot modify matchday responsibility on a finalised selection." };
    }

    await db.selection.update({
      where: { id: selectionId },
      data: { matchdayResponsibility: responsibility as MatchdayResponsibilityType | null },
    });

    const updatedSelection = await db.selection.findUnique({
      where: { id: selectionId },
      select: { explanation: true },
    });

    if (updatedSelection?.explanation) {
      const enriched = enrichExplanation(
        updatedSelection.explanation as Record<string, unknown>,
        { matchdayResponsibility: (responsibility as MatchdayResponsibilityType | null) ?? undefined },
      );
      if (enriched) {
        await db.selection.update({
          where: { id: selectionId },
          data: { explanation: enriched as unknown as Prisma.InputJsonValue },
        });
      }
    }

    revalidatePath(`/matches/${selection.matchId}`);
    revalidatePath(`/rounds`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to set matchday responsibility." };
  }
}

export async function removeMatchdayResponsibilityAction(
  selectionId: string,
): Promise<{ success: boolean; error?: string }> {
  return setMatchdayResponsibilityAction(selectionId, null);
}

export async function setTeamReflectionAction(
  matchId: string,
  data: {
    effort?: string;
    teamCohesion?: string;
    positionalShape?: string;
    recoveryBehavior?: string;
    note?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) return { success: false, error: "Match not found." };

    await db.teamReflection.upsert({
      where: { matchId },
      create: {
        matchId,
        effort: data.effort ?? null,
        teamCohesion: data.teamCohesion ?? null,
        positionalShape: data.positionalShape ?? null,
        recoveryBehavior: data.recoveryBehavior ?? null,
        note: data.note ?? null,
      },
      update: {
        ...(data.effort !== undefined && { effort: data.effort }),
        ...(data.teamCohesion !== undefined && { teamCohesion: data.teamCohesion }),
        ...(data.positionalShape !== undefined && { positionalShape: data.positionalShape }),
        ...(data.recoveryBehavior !== undefined && { recoveryBehavior: data.recoveryBehavior }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save team reflection." };
  }
}

export async function getTeamReflectionAction(
  matchId: string,
): Promise<{ success: boolean; reflection?: { id: string; effort: string | null; teamCohesion: string | null; positionalShape: string | null; recoveryBehavior: string | null; note: string | null } | null; error?: string }> {
  await requireCoachAccess();

  try {
    const reflection = await db.teamReflection.findUnique({
      where: { matchId },
    });

    return {
      success: true,
      reflection: reflection ? {
        id: reflection.id,
        effort: reflection.effort,
        teamCohesion: reflection.teamCohesion,
        positionalShape: reflection.positionalShape,
        recoveryBehavior: reflection.recoveryBehavior,
        note: reflection.note,
      } : null,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get team reflection." };
  }
}