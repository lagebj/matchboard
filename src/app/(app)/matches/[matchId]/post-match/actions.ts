'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import type { MatchReportStatus, PlannedAbsenceReason, UnplannedAppearanceReason } from "@/generated/prisma/client";

export type MatchReportDetail = {
  id: string;
  matchId: string;
  status: MatchReportStatus | "NOT_STARTED";
  homeGoals: number | null;
  awayGoals: number | null;
  teamNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
  teamName: string;
  opponent: string;
  homeAway: string;
  plannedSelections: Array<{
    playerId: string;
    playerName: string;
    coreTeamName: string;
    role: string;
  }>;
  playerActuals: Array<{
    id: string;
    playerId: string;
    playerName: string;
    coreTeamName: string;
    source: string;
    attendanceStatus: string;
    unplannedAppearanceReason: string | null;
  }>;
  absences: Array<{
    id: string;
    playerId: string;
    playerName: string;
    coreTeamName: string;
    reason: PlannedAbsenceReason;
    note: string | null;
  }>;
  playerStats: Array<{
    id: string;
    playerId: string;
    playerName: string;
    goals: number;
    assists: number;
  }>;
  goals: Array<{
    id: string;
    playerId: string | null;
    playerName?: string;
    minute: number | null;
    type: string;
  }>;
  assists: Array<{
    id: string;
    playerId: string;
    playerName: string;
    type: string;
  }>;
};

export async function getMatchReport(matchId: string): Promise<MatchReportDetail> {
  await requireCoachAccess();

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      teamId: true,
      opponent: true,
      homeAway: true,
      team: { select: { id: true, name: true } },
      selections: {
        where: { status: "FINALIZED" },
        select: {
          playerId: true,
          role: true,
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) throw new Error("Match not found.");

  const report = await db.postMatchReport.findUnique({
    where: { matchId },
    include: {
      playerActuals: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } } },
        },
      },
      goals: {
        include: {
          player: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ minute: "asc" }],
      },
      assists: {
        include: {
          player: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      absences: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } } },
        },
      },
      playerStats: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const plannedSelections = match.selections.map((s) => ({
    playerId: s.playerId,
    playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
    coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
    role: s.role,
  }));

  if (!report) {
    return {
      id: "",
      matchId: match.id,
      status: "NOT_STARTED",
      homeGoals: null,
      awayGoals: null,
      teamNote: null,
      completedBy: null,
      completedAt: null,
      teamName: match.team.name,
      opponent: match.opponent,
      homeAway: match.homeAway,
      plannedSelections,
      playerActuals: [],
      absences: [],
      playerStats: [],
      goals: [],
      assists: [],
    };
  }

  return {
    id: report.id,
    matchId: report.matchId,
    status: report.status,
    homeGoals: report.homeGoals,
    awayGoals: report.awayGoals,
    teamNote: report.teamNote,
    completedBy: report.completedBy,
    completedAt: report.completedAt?.toISOString() ?? null,
    teamName: match.team.name,
    opponent: match.opponent,
    homeAway: match.homeAway,
    plannedSelections,
    playerActuals: report.playerActuals.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
      coreTeamName: p.player.coreTeam?.name ?? "Unassigned",
      source: p.source,
      attendanceStatus: p.attendanceStatus,
      unplannedAppearanceReason: p.unplannedAppearanceReason,
    })),
    absences: report.absences.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      coreTeamName: a.player.coreTeam?.name ?? "Unassigned",
      reason: a.reason,
      note: a.note,
    })),
    playerStats: report.playerStats.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      goals: s.goals,
      assists: s.assists,
    })),
    goals: report.goals.map((g) => ({
      id: g.id,
      playerId: g.playerId,
      playerName: g.player ? `${g.player.firstName} ${g.player.lastName ?? ""}`.trim() : undefined,
      minute: g.minute,
      type: g.type,
    })),
    assists: report.assists.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      type: a.type,
    })),
  };
}

export async function seedMatchReport(matchId: string): Promise<{ success: boolean; error?: string; reportId?: string }> {
  await requireCoachAccess();

  try {
    const existing = await db.postMatchReport.findUnique({ where: { matchId } });
    if (existing) {
      return { success: false, error: "A report already exists for this match." };
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        selections: {
          where: { status: "FINALIZED" },
          select: { playerId: true, role: true },
        },
      },
    });

    if (!match) {
      return { success: false, error: "Match not found." };
    }

    const report = await db.postMatchReport.create({
      data: {
        matchId,
        status: "DRAFT",
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
    return { success: false, error: error instanceof Error ? error.message : "Failed to create report." };
  }
}

export async function updateMatchResult(
  reportId: string,
  data: { homeGoals?: number; awayGoals?: number; teamNote?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot update a locked report. Reopen it first." };

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

export async function addActualPlayer(
  reportId: string,
  data: { playerId: string; attendanceStatus?: string; unplannedAppearanceReason?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  const VALID_REASONS: string[] = [
    "EMERGENCY_SQUAD_COVER",
    "LATE_AVAILABILITY_CHANGE",
    "NO_SHOW_REPLACEMENT",
    "INJURY_REPLACEMENT",
    "OTHER_RECORDED_REASON",
  ];

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    const existing = await db.postMatchPlayerActual.findFirst({
      where: { reportId, playerId: data.playerId },
    });
    if (existing) return { success: false, error: "Player already in actual squad." };

    const reason = data.unplannedAppearanceReason?.trim();
    const unplannedAppearanceReason = reason && VALID_REASONS.includes(reason)
      ? (reason as UnplannedAppearanceReason)
      : null;

    await db.postMatchPlayerActual.create({
      data: {
        reportId,
        matchId: report.matchId,
        playerId: data.playerId,
        source: "ADDED_POST_MATCH",
        attendanceStatus: data.attendanceStatus ?? "PRESENT",
        unplannedAppearanceReason,
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add player." };
  }
}

export async function removeActualPlayer(appearanceId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const appearance = await db.postMatchPlayerActual.findUnique({
      where: { id: appearanceId },
      include: { report: { select: { matchId: true, status: true } } },
    });
    if (!appearance) return { success: false, error: "Appearance not found." };
    if (appearance.report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    if (appearance.report.status === "DRAFT") {
      await db.matchExecutionFeedback.deleteMany({
        where: { matchId: appearance.report.matchId, playerId: appearance.playerId },
      });
    }

    await db.postMatchPlayerActual.delete({ where: { id: appearanceId } });

    revalidatePath(`/matches/${appearance.report.matchId}`);
    revalidatePath(`/matches/${appearance.report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove player." };
  }
}

export async function updateAttendanceStatus(
  appearanceId: string,
  attendanceStatus: string,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const appearance = await db.postMatchPlayerActual.findUnique({
      where: { id: appearanceId },
      include: { report: { select: { matchId: true, status: true } } },
    });
    if (!appearance) return { success: false, error: "Appearance not found." };
    if (appearance.report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    if (attendanceStatus === "NO_SHOW" && appearance.report.status === "DRAFT") {
      await db.matchExecutionFeedback.deleteMany({
        where: { matchId: appearance.report.matchId, playerId: appearance.playerId },
      });
    }

    await db.postMatchPlayerActual.update({
      where: { id: appearanceId },
      data: { attendanceStatus },
    });

    revalidatePath(`/matches/${appearance.report.matchId}`);
    revalidatePath(`/matches/${appearance.report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update attendance." };
  }
}

export async function markPlannedAbsence(
  reportId: string,
  data: { playerId: string; reason: PlannedAbsenceReason; note?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    await db.matchReportAbsence.upsert({
      where: { matchReportId_playerId: { matchReportId: reportId, playerId: data.playerId } },
      update: { reason: data.reason, note: data.note ?? null },
      create: {
        matchReportId: reportId,
        matchId: report.matchId,
        playerId: data.playerId,
        reason: data.reason,
        note: data.note ?? null,
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to mark absence." };
  }
}

export async function removePlannedAbsence(absenceId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const absence = await db.matchReportAbsence.findUnique({
      where: { id: absenceId },
      include: { report: { select: { matchId: true, status: true } } },
    });
    if (!absence) return { success: false, error: "Absence not found." };
    if (absence.report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    await db.matchReportAbsence.delete({ where: { id: absenceId } });

    revalidatePath(`/matches/${absence.report.matchId}`);
    revalidatePath(`/matches/${absence.report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove absence." };
  }
}

export async function updatePlayerStats(
  reportId: string,
  data: { playerId: string; goals?: number; assists?: number },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot edit a locked report. Reopen it first." };

    const actualPlayer = await db.postMatchPlayerActual.findFirst({
      where: { reportId, playerId: data.playerId },
    });
    if (!actualPlayer) return { success: false, error: "Player must be in actual squad before receiving stats." };

    if ((data.goals ?? 0) < 0 || (data.assists ?? 0) < 0) {
      return { success: false, error: "Goals and assists must be non-negative." };
    }

    await db.matchReportPlayerStat.upsert({
      where: { matchReportId_playerId: { matchReportId: reportId, playerId: data.playerId } },
      update: {
        ...(data.goals !== undefined ? { goals: data.goals } : {}),
        ...(data.assists !== undefined ? { assists: data.assists } : {}),
      },
      create: {
        matchReportId: reportId,
        playerId: data.playerId,
        goals: data.goals ?? 0,
        assists: data.assists ?? 0,
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update stats." };
  }
}

export async function submitMatchReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
      include: { playerActuals: true },
    });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status !== "DRAFT") return { success: false, error: "Only DRAFT reports can be submitted." };

    const unknownAttendance = report.playerActuals.filter(
      (a) => a.attendanceStatus === "UNKNOWN",
    );
    if (unknownAttendance.length > 0) {
      return {
        success: false,
        error: `Cannot submit report: ${unknownAttendance.length} player(s) have UNKNOWN attendance. Resolve all attendance before submitting.`,
      };
    }

    await db.postMatchReport.update({
      where: { id: reportId },
      data: { status: "REPORTED" },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to submit report." };
  }
}

export async function lockMatchReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
      include: { playerActuals: true },
    });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status !== "REPORTED") return { success: false, error: "Only REPORTED reports can be locked." };

    const unknownAttendance = report.playerActuals.filter(
      (a) => a.attendanceStatus === "UNKNOWN",
    );
    if (unknownAttendance.length > 0) {
      return {
        success: false,
        error: `Cannot lock report: ${unknownAttendance.length} player(s) have UNKNOWN attendance. Resolve all attendance before locking.`,
      };
    }

    await db.postMatchReport.update({
      where: { id: reportId },
      data: { status: "LOCKED", completedAt: new Date() },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to lock report." };
  }
}

export async function completeMatchReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const coach = await requireCoachAccess();

    const report = await db.postMatchReport.findUnique({
      where: { id: reportId },
      include: { playerActuals: true },
    });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status !== "DRAFT" && report.status !== "REPORTED") {
      return { success: false, error: "Only DRAFT or REPORTED reports can be completed." };
    }

    const unknownAttendance = report.playerActuals.filter(
      (a) => a.attendanceStatus === "UNKNOWN",
    );
    if (unknownAttendance.length > 0) {
      return {
        success: false,
        error: `Cannot complete report: ${unknownAttendance.length} player(s) have UNKNOWN attendance. Resolve all attendance before completing.`,
      };
    }

    await db.postMatchReport.update({
      where: { id: reportId },
      data: {
        status: "LOCKED",
        completedBy: coach.email,
        completedAt: new Date(),
      },
    });

    const { resolveOpponentOnReportCompletion } = await import("@/lib/opponents/resolve-opponent");
    await resolveOpponentOnReportCompletion(report.matchId);

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/assistant");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to complete report." };
  }
}

export async function reopenMatchReport(
  reportId: string,
  targetStatus?: "DRAFT" | "REPORTED",
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status !== "LOCKED" && report.status !== "REPORTED") {
      return { success: false, error: "Only LOCKED or REPORTED reports can be reopened." };
    }
    if (report.status === "REPORTED" && targetStatus !== "DRAFT") {
      return { success: false, error: "A REPORTED report can only be reopened to DRAFT status." };
    }

    const newStatus = targetStatus ?? (report.status === "LOCKED" ? "REPORTED" : "DRAFT");

    await db.postMatchReport.update({
      where: { id: reportId },
      data: { status: newStatus, completedAt: null },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to reopen report." };
  }
}

export async function addGoalToReport(
  reportId: string,
  data: { playerId?: string; minute?: number; type?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot add goals to a locked report. Reopen it first." };

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
    revalidatePath("/players");

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
    if (!goal) return { success: false, error: "Goal not found." };
    if (goal.report.status === "LOCKED") return { success: false, error: "Cannot remove goals from a locked report. Reopen it first." };

    await db.goal.delete({ where: { id: goalId } });

    revalidatePath(`/matches/${goal.report.matchId}`);
    revalidatePath(`/matches/${goal.report.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove goal." };
  }
}

export async function addAssistToReport(
  reportId: string,
  data: { playerId: string; type?: string },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const report = await db.postMatchReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: "Report not found." };
    if (report.status === "LOCKED") return { success: false, error: "Cannot add assists to a locked report. Reopen it first." };

    await db.assist.create({
      data: {
        reportId,
        playerId: data.playerId,
        type: data.type ?? "NORMAL",
      },
    });

    revalidatePath(`/matches/${report.matchId}`);
    revalidatePath(`/matches/${report.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add assist." };
  }
}

export async function removeAssistFromReport(assistId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const assist = await db.assist.findUnique({
      where: { id: assistId },
      include: { report: { select: { matchId: true, status: true } } },
    });
    if (!assist) return { success: false, error: "Assist not found." };
    if (assist.report.status === "LOCKED") return { success: false, error: "Cannot remove assists from a locked report. Reopen it first." };

    await db.assist.delete({ where: { id: assistId } });

    revalidatePath(`/matches/${assist.report.matchId}`);
    revalidatePath(`/matches/${assist.report.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove assist." };
  }
}