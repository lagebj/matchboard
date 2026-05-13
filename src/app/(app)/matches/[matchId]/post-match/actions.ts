'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";

export async function seedPostMatchReport(matchId: string): Promise<{ success: boolean; error?: string; reportId?: string }> {
  await requireCoachAccess();

  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        matchRoundId: true,
        teamId: true,
        selections: {
          where: { status: "FINALIZED" },
          select: {
            id: true,
            playerId: true,
            role: true,
          },
        },
      },
    });

    if (!match) {
      return { success: false, error: "Match not found." };
    }

    if (match.selections.length === 0) {
      return { success: false, error: "No finalized selections found for this match. Finalize the round first." };
    }

    const existing = await db.postMatchReport.findUnique({
      where: { matchId },
    });

    if (existing) {
      return { success: false, error: "A post-match report already exists for this match." };
    }

    const report = await db.postMatchReport.create({
      data: {
        matchId,
        status: "IN_PROGRESS",
        playerActuals: {
          create: match.selections.map((s) => ({
            matchId,
            playerId: s.playerId,
            source: "PLANNED",
            attendanceStatus: "UNKNOWN",
          })),
        },
      },
    });

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return { success: true, reportId: report.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create post-match report." };
  }
}

export async function addGoalToReport(
  reportId: string,
  data: { playerId?: string; minute?: number; type?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: "Report not found." };
    }

    if (report.status === "COMPLETED") {
      return { success: false, error: "Cannot add goals to a completed report." };
    }

    await db.goal.create({
      data: {
        reportId,
        playerId: data.playerId || null,
        minute: data.minute ?? null,
        type: data.type ?? "NORMAL",
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add goal." };
  }
}

export async function removeGoalFromReport(goalId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const goal = await db.goal.findUnique({
      where: { id: goalId },
      include: { report: { select: { matchId: true, status: true } } },
    });

    if (!goal) {
      return { success: false, error: "Goal not found." };
    }

    if (goal.report.status === "COMPLETED") {
      return { success: false, error: "Cannot remove goals from a completed report." };
    }

    await db.goal.delete({ where: { id: goalId } });

    revalidatePath(`/matches/${goal.report.matchId}`);
    revalidatePath(`/matches/${goal.report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove goal." };
  }
}

export async function updateMatchResult(
  reportId: string,
  data: { homeGoals?: number; awayGoals?: number; teamNote?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: "Report not found." };
    }

    if (report.status === "COMPLETED") {
      return { success: false, error: "Cannot update a completed report." };
    }

    await db.postMatchReport.update({
      where: { id: reportId },
      data: {
        ...(data.homeGoals !== undefined ? { homeGoals: data.homeGoals } : {}),
        ...(data.awayGoals !== undefined ? { awayGoals: data.awayGoals } : {}),
        ...(data.teamNote !== undefined ? { teamNote: data.teamNote } : {}),
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update result." };
  }
}

export async function addPlayerAppearance(
  reportId: string,
  data: { playerId: string; attendanceStatus?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: "Report not found." };
    }

    if (report.status === "COMPLETED") {
      return { success: false, error: "Cannot add players to a completed report." };
    }

    await db.postMatchPlayerActual.create({
      data: {
        reportId,
        matchId: report.matchId,
        playerId: data.playerId,
        source: "ADDED_POST_MATCH",
        attendanceStatus: data.attendanceStatus ?? "PRESENT",
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add player." };
  }
}

export async function removePlayerAppearance(
  appearanceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const appearance = await db.postMatchPlayerActual.findUnique({
      where: { id: appearanceId },
      include: { report: { select: { matchId: true, status: true } } },
    });

    if (!appearance) {
      return { success: false, error: "Appearance not found." };
    }

    if (appearance.report.status === "COMPLETED") {
      return { success: false, error: "Cannot remove players from a completed report." };
    }

    await db.postMatchPlayerActual.delete({ where: { id: appearanceId } });

    revalidatePath(`/matches/${appearance.report.matchId}`);
    revalidatePath(`/matches/${appearance.report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove player." };
  }
}

export async function finalizePostMatchReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: "Report not found." };
    }

    if (report.status === "COMPLETED") {
      return { success: false, error: "Report is already completed." };
    }

    await db.postMatchReport.update({
      where: { id: reportId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to finalize report." };
  }
}