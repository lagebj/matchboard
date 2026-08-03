'use server'

import { revalidatePath } from "next/cache";
import { requireActorContext, requireMutationRole, requireMatchTeamAccess } from "@/lib/auth/actor-context";
import type { MatchReportStatus, PlannedAbsenceReason } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  seedReportFromFinalizedSquad,
  updateReportResult,
  addActualPlayerToReport,
  removeActualPlayerFromReport,
  updateAttendanceInReport,
  markPlannedAbsenceInReport,
  removePlannedAbsenceFromReport,
  updatePlayerStatsInReport,
  submitReport,
  lockReport,
  completeReport,
  reopenReport,
  addGoalToReportMutation,
  removeGoalFromReportMutation,
  addAssistToReportMutation,
  removeAssistFromReportMutation,
} from "@/lib/reports/report-mutations";
import { logReportComplete, logReportReopen } from "@/lib/security/audit-log";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireReportOrgAccess(reportId: string, orgFilter: OrgFilterMode): Promise<string | null> {
  if (orgFilter.type !== "org") return null;
  const report = await db.postMatchReport.findFirst({
    where: { id: reportId, match: orgFilter.filter },
    select: { id: true, matchId: true },
  });
  if (!report) throw new Error("Report not found or access denied.");
  return report.matchId;
}

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
  const ctx = await requireActorContext();

  const match = await db.match.findUnique({
    where: { id: matchId, ...(ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {}) },
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await requireMatchTeamAccess(ctx, matchId);
  if (ctx.orgFilter.type === "org") {
    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
  }

  try {
    const result = await seedReportFromFinalizedSquad(matchId);
    if (!result.success) return { success: false, error: result.error };

    const report = await db.postMatchReport.findUnique({ where: { matchId } });
    if (!report) return { success: false, error: "Failed to retrieve created report." };

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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await updateReportResult(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update result." };
  }
}

export async function addActualPlayer(
  reportId: string,
  data: { playerId: string; attendanceStatus?: string; unplannedAppearanceReason?: string },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await addActualPlayerToReport(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add player." };
  }
}

export async function removeActualPlayer(appearanceId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const appearance = await db.postMatchPlayerActual.findFirst({
      where: { id: appearanceId, report: ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!appearance) return { success: false, error: "Appearance not found or access denied." };
  }

  try {
    const result = await removeActualPlayerFromReport(appearanceId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove player." };
  }
}

export async function updateAttendanceStatus(
  appearanceId: string,
  attendanceStatus: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const appearance = await db.postMatchPlayerActual.findFirst({
      where: { id: appearanceId, report: ctx.orgFilter.filter },
      select: { id: true, report: { select: { matchId: true } } },
    });
    if (!appearance) return { success: false, error: "Appearance not found or access denied." };
    await requireMatchTeamAccess(ctx, appearance.report.matchId);
  }

  try {
    const result = await updateAttendanceInReport(appearanceId, attendanceStatus);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update attendance." };
  }
}

export async function markPlannedAbsence(
  reportId: string,
  data: { playerId: string; reason: PlannedAbsenceReason; note?: string },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await markPlannedAbsenceInReport(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to mark absence." };
  }
}

export async function removePlannedAbsence(absenceId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const absence = await db.matchReportAbsence.findFirst({
      where: { id: absenceId, report: ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!absence) return { success: false, error: "Absence not found or access denied." };
  }

  try {
    const result = await removePlannedAbsenceFromReport(absenceId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove absence." };
  }
}

export async function updatePlayerStats(
  reportId: string,
  data: { playerId: string; goals?: number; assists?: number },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await updatePlayerStatsInReport(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update stats." };
  }
}

export async function submitMatchReport(reportId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await submitReport(reportId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await lockReport(reportId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const report = await db.postMatchReport.findFirst({
      where: { id: reportId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!report) return { success: false, error: "Report not found or access denied." };
  }

  try {
    const result = await completeReport(reportId, ctx.email || "unknown");
    if (!result.success) {
      logReportComplete(ctx.email || "unknown", reportId, "failure", result.error);
      return { success: false, error: result.error };
    }

    logReportComplete(ctx.email || "unknown", reportId, "success");

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/assistant");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    logReportComplete("unknown", reportId, "failure", error instanceof Error ? error.message : "Unknown error");
    return { success: false, error: error instanceof Error ? error.message : "Failed to complete report." };
  }
}

export async function reopenMatchReport(
  reportId: string,
  targetStatus?: "DRAFT" | "REPORTED",
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const report = await db.postMatchReport.findFirst({
      where: { id: reportId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!report) return { success: false, error: "Report not found or access denied." };
  }

  try {
    const result = await reopenReport(reportId, targetStatus);
    if (!result.success) {
      logReportReopen(ctx.email || "unknown", reportId, "failure", result.error);
      return { success: false, error: result.error };
    }

    logReportReopen(ctx.email || "unknown", reportId, "success");

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
    revalidatePath("/rounds");
    revalidatePath("/fixtures");
    revalidatePath("/teams");
    revalidatePath("/players");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    logReportReopen("unknown", reportId, "failure", error instanceof Error ? error.message : "Unknown error");
    return { success: false, error: error instanceof Error ? error.message : "Failed to reopen report." };
  }
}

export async function addGoalToReport(
  reportId: string,
  data: { playerId?: string; minute?: number; type?: string },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await addGoalToReportMutation(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add goal." };
  }
}

export async function removeGoalFromReport(goalId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const goal = await db.goal.findFirst({
      where: { id: goalId, report: ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!goal) return { success: false, error: "Goal not found or access denied." };
  }

  try {
    const result = await removeGoalFromReportMutation(goalId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const reportMatchId = await requireReportOrgAccess(reportId, ctx.orgFilter);
  if (reportMatchId) await requireMatchTeamAccess(ctx, reportMatchId);

  try {
    const result = await addAssistToReportMutation(reportId, data);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add assist." };
  }
}

export async function removeAssistFromReport(assistId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (ctx.orgFilter.type === "org") {
    const assist = await db.assist.findFirst({
      where: { id: assistId, report: ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!assist) return { success: false, error: "Assist not found or access denied." };
  }

  try {
    const result = await removeAssistFromReportMutation(assistId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath(`/matches/${result.matchId}`);
    revalidatePath(`/matches/${result.matchId}/post-match`);
    revalidatePath("/players");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove assist." };
  }
}