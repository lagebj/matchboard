import { db } from "@/lib/db";
import type { MatchReportStatus, PlannedAbsenceReason, UnplannedAppearanceReason, PostMatchAttendanceStatus, GoalType, AssistType } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  VALID_UNPLANNED_APPEARANCE_REASONS,
  DEFAULT_GOAL_TYPE,
  DEFAULT_ASSIST_TYPE,
  canTransitionTo,
  isReportLocked,
  hasUnknownAttendance,
} from "./report-domain";

export type ReportTransitionResult =
  | { success: true; matchId: string }
  | { success: false; error: string };

export async function seedReportFromFinalizedSquad(matchId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const existing = await db.postMatchReport.findFirst({ where: { matchId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (existing) {
    return { success: false, error: "A report already exists for this match." };
  }

  const match = await db.match.findFirst({
    where: { id: matchId, ...(orgFilter ? orgFilter.filter : {}) },
    select: {
      id: true,
      organisationId: true,
      selections: {
        where: { status: "FINALIZED" },
        select: { playerId: true, role: true },
      },
      helperAssignments: {
        select: { playerId: true },
      },
    },
  });

  if (!match) {
    return { success: false, error: "Match not found." };
  }

  const plannedPlayerIds = new Set(match.selections.map((s) => s.playerId));

  const report = await db.postMatchReport.create({
    data: {
      organisationId: match.organisationId,
      matchId,
      status: "DRAFT",
      playerActuals: {
        create: [
          ...match.selections.map((s) => ({
            organisationId: match.organisationId,
            matchId,
            playerId: s.playerId,
            source: "PLANNED" as const,
            attendanceStatus: "UNKNOWN" as const,
          })),
          // League Match helpers (ADR-0077): seeded unconditionally, same as the planned squad,
          // so a helper added before the match is already present here — the coach never adds
          // them again retroactively. `plannedPlayerIds` guard is defensive only; the add-helper
          // action already refuses a player who's already a Selection participant in this match.
          ...match.helperAssignments
            .filter((h) => !plannedPlayerIds.has(h.playerId))
            .map((h) => ({
              organisationId: match.organisationId,
              matchId,
              playerId: h.playerId,
              source: "EMERGENCY_BACKFILL" as const,
              attendanceStatus: "UNKNOWN" as const,
              unplannedAppearanceReason: "EMERGENCY_SQUAD_COVER" as const,
            })),
        ],
      },
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function updateReportResult(
  reportId: string,
  data: { homeGoals?: number; awayGoals?: number; teamNote?: string },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot update a locked report. Reopen it first." };
  }

  await db.postMatchReport.update({
    where: { id: reportId },
    data: {
      ...(data.homeGoals !== undefined ? { homeGoals: data.homeGoals } : {}),
      ...(data.awayGoals !== undefined ? { awayGoals: data.awayGoals } : {}),
      ...(data.teamNote !== undefined ? { teamNote: data.teamNote } : {}),
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function addActualPlayerToReport(
  reportId: string,
  data: { playerId: string; attendanceStatus?: PostMatchAttendanceStatus; unplannedAppearanceReason?: string },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  const existing = await db.postMatchPlayerActual.findFirst({
    where: { reportId, playerId: data.playerId },
  });
  if (existing) return { success: false, error: "Player already in actual squad." };

  const reason = data.unplannedAppearanceReason?.trim();
  const unplannedAppearanceReason: UnplannedAppearanceReason | null =
    reason && VALID_UNPLANNED_APPEARANCE_REASONS.includes(reason)
      ? (reason as UnplannedAppearanceReason)
      : null;

  await db.postMatchPlayerActual.create({
    data: {
      organisationId: report.organisationId,
      reportId,
      matchId: report.matchId,
      playerId: data.playerId,
      source: "ADDED_POST_MATCH" as const,
      attendanceStatus: data.attendanceStatus ?? "PRESENT",
      unplannedAppearanceReason,
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function removeActualPlayerFromReport(appearanceId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const appearance = await db.postMatchPlayerActual.findFirst({
    where: { id: appearanceId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { report: { select: { matchId: true, status: true } } },
  });
  if (!appearance) return { success: false, error: "Appearance not found." };
  if (isReportLocked(appearance.report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  if (appearance.report.status === "DRAFT") {
    await db.matchExecutionFeedback.deleteMany({
      where: { matchId: appearance.report.matchId, playerId: appearance.playerId },
    });
  }

  await db.postMatchPlayerActual.delete({ where: { id: appearanceId } });

  return { success: true, matchId: appearance.report.matchId };
}

export async function updateAttendanceInReport(
  appearanceId: string,
  attendanceStatus: PostMatchAttendanceStatus,
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const appearance = await db.postMatchPlayerActual.findFirst({
    where: { id: appearanceId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { report: { select: { matchId: true, status: true } } },
  });
  if (!appearance) return { success: false, error: "Appearance not found." };
  if (isReportLocked(appearance.report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  if (attendanceStatus === "NO_SHOW" && appearance.report.status === "DRAFT") {
    await db.matchExecutionFeedback.deleteMany({
      where: { matchId: appearance.report.matchId, playerId: appearance.playerId },
    });
  }

  await db.postMatchPlayerActual.update({
    where: { id: appearanceId },
    data: { attendanceStatus },
  });

  return { success: true, matchId: appearance.report.matchId };
}

export async function markPlannedAbsenceInReport(
  reportId: string,
  data: { playerId: string; reason: PlannedAbsenceReason; note?: string },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  await db.matchReportAbsence.upsert({
    where: { matchReportId_playerId: { matchReportId: reportId, playerId: data.playerId } },
    update: { reason: data.reason, note: data.note ?? null },
    create: {
      organisationId: report.organisationId,
      matchReportId: reportId,
      matchId: report.matchId,
      playerId: data.playerId,
      reason: data.reason,
      note: data.note ?? null,
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function removePlannedAbsenceFromReport(absenceId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const absence = await db.matchReportAbsence.findFirst({
    where: { id: absenceId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { report: { select: { matchId: true, status: true } } },
  });
  if (!absence) return { success: false, error: "Absence not found." };
  if (isReportLocked(absence.report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  await db.matchReportAbsence.delete({ where: { id: absenceId } });

  return { success: true, matchId: absence.report.matchId };
}

export async function updatePlayerStatsInReport(
  reportId: string,
  data: { playerId: string; goals?: number; assists?: number },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot edit a locked report. Reopen it first." };
  }

  const actualPlayer = await db.postMatchPlayerActual.findFirst({
    where: { reportId, playerId: data.playerId },
  });
  if (!actualPlayer) {
    return { success: false, error: "Player must be in actual squad before receiving stats." };
  }

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
      organisationId: report.organisationId,
      matchReportId: reportId,
      playerId: data.playerId,
      goals: data.goals ?? 0,
      assists: data.assists ?? 0,
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function submitReport(reportId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({
    where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { playerActuals: true },
  });
  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, "REPORTED").allowed) {
    return { success: false, error: "Only DRAFT reports can be submitted." };
  }

  const unknownAttendance = hasUnknownAttendance(report.playerActuals);
  if (unknownAttendance) {
    return {
      success: false,
      error: `Cannot submit report: ${unknownAttendance} player(s) have UNKNOWN attendance. Resolve all attendance before submitting.`,
    };
  }

  await db.postMatchReport.update({
    where: { id: reportId },
    data: { status: "REPORTED" as MatchReportStatus },
  });

  return { success: true, matchId: report.matchId };
}

export async function lockReport(reportId: string): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findUnique({
    where: { id: reportId },
    include: { playerActuals: true },
  });
  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, "LOCKED").allowed) {
    return { success: false, error: "Only REPORTED reports can be locked." };
  }

  const unknownAttendance = hasUnknownAttendance(report.playerActuals);
  if (unknownAttendance) {
    return {
      success: false,
      error: `Cannot lock report: ${unknownAttendance} player(s) have UNKNOWN attendance. Resolve all attendance before locking.`,
    };
  }

  await db.postMatchReport.update({
    where: { id: reportId },
    data: { status: "LOCKED" as MatchReportStatus, completedAt: new Date() },
  });

  return { success: true, matchId: report.matchId };
}

export async function completeReport(reportId: string, coachEmail: string): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findUnique({
    where: { id: reportId },
    include: { playerActuals: true },
  });
  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, "LOCKED").allowed) {
    return { success: false, error: "Only DRAFT or REPORTED reports can be completed." };
  }

  const unknownAttendance = hasUnknownAttendance(report.playerActuals);
  if (unknownAttendance) {
    return {
      success: false,
      error: `Cannot complete report: ${unknownAttendance} player(s) have UNKNOWN attendance. Resolve all attendance before completing.`,
    };
  }

  await db.postMatchReport.update({
    where: { id: reportId },
    data: {
      status: "LOCKED" as MatchReportStatus,
      completedBy: coachEmail,
      completedAt: new Date(),
    },
  });

  const { resolveOpponentOnReportCompletion } = await import("@/lib/opponents/resolve-opponent");
  await resolveOpponentOnReportCompletion(report.matchId);

  try {
    const { requireActorContext } = await import("@/lib/auth/actor-context");
    const ctx = await requireActorContext();
    const { recordOpponentSportingEvidence } = await import("@/lib/opponents/sporting-level-recording");
    await recordOpponentSportingEvidence(report.matchId, ctx.orgFilter);
  } catch {
    // Sporting evidence recording must not block report completion
  }

  return { success: true, matchId: report.matchId };
}

export async function reopenReport(
  reportId: string,
  targetStatus?: "DRAFT" | "REPORTED",
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, targetStatus ?? "REPORTED").allowed) {
    return { success: false, error: "Only LOCKED or REPORTED reports can be reopened." };
  }

  if (report.status === "REPORTED" && targetStatus !== "DRAFT") {
    return { success: false, error: "A REPORTED report can only be reopened to DRAFT status." };
  }

  const newStatus = targetStatus ?? (report.status === "LOCKED" ? "REPORTED" : "DRAFT");

  await db.postMatchReport.update({
    where: { id: reportId },
    data: { status: newStatus as MatchReportStatus, completedAt: null },
  });

  return { success: true, matchId: report.matchId };
}

export async function addGoalToReportMutation(
  reportId: string,
  data: { playerId?: string; minute?: number; type?: GoalType },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot add goals to a locked report. Reopen it first." };
  }

  await db.goal.create({
    data: {
      organisationId: report.organisationId,
      reportId,
      playerId: data.playerId || null,
      minute: data.minute ?? null,
      type: data.type ?? DEFAULT_GOAL_TYPE,
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function removeGoalFromReportMutation(goalId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { report: { select: { matchId: true, status: true } } },
  });
  if (!goal) return { success: false, error: "Goal not found." };
  if (isReportLocked(goal.report.status)) {
    return { success: false, error: "Cannot remove goals from a locked report. Reopen it first." };
  }

  await db.goal.delete({ where: { id: goalId } });

  return { success: true, matchId: goal.report.matchId };
}

export async function addAssistToReportMutation(
  reportId: string,
  data: { playerId: string; type?: AssistType },
  orgFilter?: OrgFilterMode,
): Promise<ReportTransitionResult> {
  const report = await db.postMatchReport.findFirst({ where: { id: reportId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (!report) return { success: false, error: "Report not found." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot add assists to a locked report. Reopen it first." };
  }

  await db.assist.create({
    data: {
      organisationId: report.organisationId,
      reportId,
      playerId: data.playerId,
      type: data.type ?? DEFAULT_ASSIST_TYPE,
    },
  });

  return { success: true, matchId: report.matchId };
}

export async function removeAssistFromReportMutation(assistId: string, orgFilter?: OrgFilterMode): Promise<ReportTransitionResult> {
  const assist = await db.assist.findFirst({
    where: { id: assistId, ...(orgFilter ? orgFilter.filter : {}) },
    include: { report: { select: { matchId: true, status: true } } },
  });
  if (!assist) return { success: false, error: "Assist not found." };
  if (isReportLocked(assist.report.status)) {
    return { success: false, error: "Cannot remove assists from a locked report. Reopen it first." };
  }

  await db.assist.delete({ where: { id: assistId } });

  return { success: true, matchId: assist.report.matchId };
}