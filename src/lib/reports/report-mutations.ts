import { db } from "@/lib/db";
import type { MatchReportStatus, PlannedAbsenceReason, UnplannedAppearanceReason, PostMatchAttendanceStatus, GoalType, AssistType, FairPlayCategory } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  VALID_UNPLANNED_APPEARANCE_REASONS,
  DEFAULT_GOAL_TYPE,
  DEFAULT_ASSIST_TYPE,
  canTransitionTo,
  isReportLocked,
  hasUnknownAttendance,
} from "./report-domain";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

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

const PERIOD_TO_INT: Record<string, number> = {
  BEFORE: 0,
  FIRST_HALF: 1,
  HALF_TIME: 2,
  SECOND_HALF: 3,
  EXTRA_FIRST_HALF: 4,
  EXTRA_HALF_TIME: 5,
  EXTRA_SECOND_HALF: 6,
  FULL_TIME: 7,
};

const FAIR_PLAY_POSITIVE_CATEGORIES = new Set([
  "HELPED_OPPONENT",
  "CHECKED_ON_INJURED_PLAYER",
  "ACCEPTED_REFEREE_DECISION",
  "ENCOURAGED_TEAMMATE",
  "CALMED_DIFFICULT_SITUATION",
  "OTHER_POSITIVE",
]);

const FAIR_PLAY_CONCERN_CATEGORIES = new Set([
  "RETALIATION",
  "ABUSIVE_LANGUAGE",
  "DISSENT_TOWARD_REFEREE",
  "TAUNTING_OR_PROVOKING",
  "DISRESPECT_TOWARD_TEAMMATE",
  "OTHER_CONCERN",
]);

const ALL_FAIR_PLAY_CATEGORIES = new Set([...FAIR_PLAY_POSITIVE_CATEGORIES, ...FAIR_PLAY_CONCERN_CATEGORIES]);

function fairPlayCategoryFromEvent(eventType: string, payload: Record<string, unknown> | null): string {
  const category = (payload as Record<string, unknown> | null)?.category;
  if (typeof category === "string" && ALL_FAIR_PLAY_CATEGORIES.has(category)) {
    return category;
  }
  return eventType === "FAIR_PLAY_POSITIVE" ? "OTHER_POSITIVE" : "OTHER_CONCERN";
}

export type SeedReportFromLiveSessionResult =
  | { success: true; matchId: string; reportId: string; status: MatchReportStatus; alreadyExisted: boolean }
  | { success: false; error: string };

/**
 * Run -> Learn handoff for a match that just ended a live-reporting session (ADR-0088). Distinct
 * strategy from `seedReportFromFinalizedSquad()` above — this one seeds `PRESENT` attendance and
 * derives goals/assists/fair-play/rotations from the session's `LiveMatchEvent` rows, since the
 * coach already recorded them live, rather than seeding `UNKNOWN` for a coach to fill in
 * manually. Both are legitimate seeding strategies for the same lifecycle transition (the first
 * DRAFT post-match report); which one applies depends on whether a live session produced events
 * to derive from. The caller (`endLiveSessionAndCreateReportAction`) is responsible for
 * validating session/match/organisation consistency before calling this — `organisationId` here
 * is trusted, not re-derived.
 */
export async function seedReportFromLiveSession(
  matchId: string,
  organisationId: string,
): Promise<SeedReportFromLiveSessionResult> {
  const existingReport = await db.postMatchReport.findUnique({
    where: { matchId },
    select: { id: true, status: true },
  });

  if (existingReport) {
    return {
      success: true,
      matchId,
      reportId: existingReport.id,
      status: existingReport.status,
      alreadyExisted: true,
    };
  }

  const selections = await db.selection.findMany({
    where: { matchId, status: "FINALIZED" },
    select: { playerId: true },
  });

  const liveEvents = await db.liveMatchEvent.findMany({
    where: {
      matchId,
      OR: [
        { correctionType: null },
        { correctionType: "CORRECTION" },
      ],
      eventType: { in: ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET", "FAIR_PLAY_POSITIVE", "FAIR_PLAY_CONCERN", "ROTATION_OUT", "ROTATION_IN"] },
    },
    select: {
      id: true,
      eventType: true,
      playerId: true,
      secondaryPlayerId: true,
      period: true,
      matchSeconds: true,
      payload: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const goalsFor = liveEvents.filter((e) => e.eventType === "GOAL_FOR").length;
  const goalsAgainst = liveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length;

  const scorerEvents = liveEvents.filter((e) => e.eventType === "SCORER_SET" && e.playerId !== null);
  const assistEvents = liveEvents.filter((e) => e.eventType === "ASSIST_SET" && e.playerId !== null);

  const fairPlayEvents = liveEvents.filter(
    (e) => (e.eventType === "FAIR_PLAY_POSITIVE" || e.eventType === "FAIR_PLAY_CONCERN") && e.playerId !== null,
  );

  const rotationPairs: { outPlayerId: string; inPlayerId: string; period: number | null; matchSeconds: number | null }[] = [];
  const rotationOutEvents = liveEvents.filter((e) => e.eventType === "ROTATION_OUT");
  const rotationInEvents = liveEvents.filter((e) => e.eventType === "ROTATION_IN");

  for (const outEvent of rotationOutEvents) {
    if (!outEvent.playerId) continue;
    const matchingIn = rotationInEvents.find(
      (inEvent) =>
        inEvent.playerId &&
        inEvent.period === outEvent.period &&
        inEvent.matchSeconds !== null &&
        outEvent.matchSeconds !== null &&
        Math.abs((inEvent.matchSeconds ?? 0) - (outEvent.matchSeconds ?? 0)) < 30000 &&
        !rotationPairs.some((rp) => rp.outPlayerId === outEvent.playerId),
    );
    if (matchingIn && matchingIn.playerId) {
      rotationPairs.push({
        outPlayerId: outEvent.playerId,
        inPlayerId: matchingIn.playerId,
        period: outEvent.period ? parseInt(String(outEvent.period), 10) : null,
        matchSeconds: outEvent.matchSeconds,
      });
    }
  }

  const report = await db.postMatchReport.create({
    data: {
      matchId,
      status: "DRAFT",
      homeGoals: goalsFor,
      awayGoals: goalsAgainst,
      organisationId,
      playerActuals: {
        create: selections.map((s) => ({
          matchId,
          playerId: s.playerId,
          source: "PLANNED",
          attendanceStatus: "PRESENT",
          organisationId,
        })),
      },
      goals: {
        create: scorerEvents.map((e) => ({
          playerId: e.playerId!,
          type: "NORMAL",
          organisationId,
        })),
      },
      assists: {
        create: assistEvents.map((e) => ({
          playerId: e.playerId!,
          type: "NORMAL",
          organisationId,
        })),
      },
    },
  });

  if (fairPlayEvents.length > 0) {
    await db.fairPlayObservation.createMany({
      data: fairPlayEvents.map((e) => ({
        matchId,
        playerId: e.playerId!,
        category: fairPlayCategoryFromEvent(e.eventType, e.payload as Record<string, unknown> | null) as FairPlayCategory,
        source: "LIVE",
        status: "PROVISIONAL",
        period: e.period ? PERIOD_TO_INT[String(e.period)] ?? null : null,
        matchSeconds: e.matchSeconds,
        liveEventId: e.id,
        organisationId,
      })),
    });
  }

  if (rotationPairs.length > 0) {
    await db.matchRotation.createMany({
      data: rotationPairs.map((rp) => ({
        matchId,
        outPlayerId: rp.outPlayerId,
        inPlayerId: rp.inPlayerId,
        period: rp.period ?? 0,
        matchSeconds: rp.matchSeconds,
        source: "LIVE",
        organisationId,
      })),
    });
  }

  return {
    success: true,
    matchId,
    reportId: report.id,
    status: report.status,
    alreadyExisted: false,
  };
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
    setTenantOrganisationId(ctx.organisationId);
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