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
import { deriveInitialAttendance } from "@/lib/matches/attendance-derivation";

export type ReportTransitionResult =
  | { success: true; matchId: string }
  | { success: false; error: string };

export async function seedReportFromFinalizedSquad(
  matchId: string,
  orgFilter?: OrgFilterMode,
  options?: { selectionStatuses?: Array<"DRAFT" | "FINALIZED"> },
): Promise<ReportTransitionResult> {
  const existing = await db.postMatchReport.findFirst({ where: { matchId, ...(orgFilter ? orgFilter.filter : {}) } });
  if (existing) {
    return { success: false, error: "A report already exists for this match." };
  }

  const selectionStatuses = options?.selectionStatuses ?? ["FINALIZED"];

  const match = await db.match.findFirst({
    where: { id: matchId, ...(orgFilter ? orgFilter.filter : {}) },
    select: {
      id: true,
      organisationId: true,
      matchRoundId: true,
      selections: {
        where: { status: { in: selectionStatuses } },
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

  const allPlayerIds = [
    ...match.selections.map((s) => s.playerId),
    ...match.helperAssignments.map((h) => h.playerId),
  ];

  const [availabilities, absences] = await Promise.all([
    db.availability.findMany({
      where: {
        playerId: { in: allPlayerIds },
        matchRoundId: match.matchRoundId,
      },
      select: { playerId: true, status: true },
    }),
    db.matchReportAbsence.findMany({
      where: { matchId, playerId: { in: allPlayerIds } },
      select: { playerId: true, reason: true },
    }),
  ]);

  const availabilityByPlayerId = new Map(availabilities.map((a) => [a.playerId, a.status]));
  const absenceByPlayerId = new Map(absences.map((a) => [a.playerId, a.reason]));

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
            attendanceStatus: deriveInitialAttendance(s.playerId, availabilityByPlayerId, absenceByPlayerId),
          })),
          ...match.helperAssignments
            .filter((h) => !plannedPlayerIds.has(h.playerId))
            .map((h) => ({
              organisationId: match.organisationId,
              matchId,
              playerId: h.playerId,
              source: "EMERGENCY_BACKFILL" as const,
              attendanceStatus: deriveInitialAttendance(h.playerId, availabilityByPlayerId, absenceByPlayerId),
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

  // League Match helpers (ADR-0077): unioned in the same way seedReportFromFinalizedSquad
  // does, so a helper added before or during the match is already present here instead of
  // requiring the coach to add them again retroactively. The `plannedPlayerIds` guard is
  // defensive only — a player can never be both a FINALIZED Selection and a helper for the
  // same match (assertLeagueMatchHelperEligible already rejects that combination).
  const helperAssignments = await db.matchHelperAssignment.findMany({
    where: { matchId },
    select: { playerId: true },
  });
  const plannedPlayerIds = new Set(selections.map((s) => s.playerId));
  const helperPlayerIds = helperAssignments
    .map((h) => h.playerId)
    .filter((playerId) => !plannedPlayerIds.has(playerId));

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

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { homeAway: true },
  });

  const goalsFor = liveEvents.filter((e) => e.eventType === "GOAL_FOR").length;
  const goalsAgainst = liveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length;

  // GOAL_FOR is always "our team" and GOAL_AGAINST is always "opponent", but
  // PostMatchReport.homeGoals/awayGoals are venue-relative: homeGoals = home team's
  // goals, awayGoals = away team's goals. When we're the away team, our goals go in
  // awayGoals and the opponent's go in homeGoals.
  const isHome = match?.homeAway === "HOME";
  const homeGoals = isHome ? goalsFor : goalsAgainst;
  const awayGoals = isHome ? goalsAgainst : goalsFor;

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
      homeGoals,
      awayGoals,
      organisationId,
      playerActuals: {
        create: [
          ...selections.map((s) => ({
            matchId,
            playerId: s.playerId,
            source: "PLANNED" as const,
            attendanceStatus: "PRESENT" as const,
            organisationId,
          })),
          ...helperPlayerIds.map((playerId) => ({
            matchId,
            playerId,
            source: "EMERGENCY_BACKFILL" as const,
            attendanceStatus: "PRESENT" as const,
            unplannedAppearanceReason: "EMERGENCY_SQUAD_COVER" as const,
            organisationId,
          })),
        ],
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

  // ADR-0106: PostMatchPlayerActual.playerId is now nullable (a GuestPlayer appearance uses
  // guestPlayerId instead) -- MatchExecutionFeedback.playerId is a real Player-only field with
  // no GuestPlayer equivalent, so there is nothing to clean up for a null (guest) appearance.
  if (appearance.report.status === "DRAFT" && appearance.playerId) {
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

  // ADR-0106: see removeActualPlayerFromReport's identical guard above.
  if (attendanceStatus === "NO_SHOW" && appearance.report.status === "DRAFT" && appearance.playerId) {
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

export type MatchAbsenceResult =
  | { success: true; matchId: string; reportId: string }
  | { success: false; error: string };

/**
 * Match-specific player absence (production consistency pass item #3): a coach marks an
 * assigned player Away/Sick/No-show/Declined for one specific match, before or around
 * kick-off, without touching their round/team assignment (the `Selection` row is untouched —
 * this reuses the existing `MatchReportAbsence` structured-absence concept, keyed directly by
 * `matchId`, rather than introducing a second competing model).
 *
 * `MatchReportAbsence` normally only exists once a post-match report exists, which is usually
 * created after the match. Marking an absence before kick-off needs somewhere to attach it, so
 * this seeds a report early via `seedReportFromFinalizedSquad` when none exists yet — including
 * DRAFT selections (not just FINALIZED), since a round is very often still in draft before
 * kick-off. This is the only caller that broadens the selection-status filter; the normal
 * post-match "After match" entry point keeps its FINALIZED-only default.
 *
 * Also upserts the player's `PostMatchPlayerActual.attendanceStatus` to NO_SHOW so the eventual
 * report is never blocked by a stale UNKNOWN attendance the coach already explained pre-match —
 * "automatically appear in the post-match report with the recorded absence state."
 */
export async function markMatchAbsence(
  matchId: string,
  data: { playerId: string; reason: PlannedAbsenceReason; note?: string },
  orgFilter: OrgFilterMode,
): Promise<MatchAbsenceResult> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, organisationId: true },
  });
  if (!match) return { success: false, error: "Match not found or access denied." };

  let report = await db.postMatchReport.findFirst({ where: { matchId } });
  if (!report) {
    const seedResult = await seedReportFromFinalizedSquad(matchId, orgFilter, { selectionStatuses: ["DRAFT", "FINALIZED"] });
    if (!seedResult.success) return { success: false, error: seedResult.error };
    report = await db.postMatchReport.findFirst({ where: { matchId } });
    if (!report) return { success: false, error: "Failed to prepare a report for this match." };
  }

  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot mark absence: report is locked. Reopen it first." };
  }

  const markResult = await markPlannedAbsenceInReport(report.id, data, orgFilter);
  if (!markResult.success) return markResult;

  const existingActual = await db.postMatchPlayerActual.findFirst({
    where: { reportId: report.id, playerId: data.playerId },
  });
  if (existingActual) {
    await db.postMatchPlayerActual.update({
      where: { id: existingActual.id },
      data: { attendanceStatus: "NO_SHOW" },
    });
  } else {
    await db.postMatchPlayerActual.create({
      data: {
        organisationId: match.organisationId,
        reportId: report.id,
        matchId,
        playerId: data.playerId,
        source: "PLANNED",
        attendanceStatus: "NO_SHOW",
      },
    });
  }

  return { success: true, matchId, reportId: report.id };
}

/**
 * Reverses markMatchAbsence — restores the player to their pre-absence attendance state.
 * Only meaningful before the report is locked; the coach uses the existing post-match
 * correction mechanism after that.
 *
 * When clearing an absence, the player's attendance is restored to their pre-match
 * availability status (AVAILABLE/TENTATIVE → PRESENT) rather than always UNKNOWN,
 * since clearing an absence means the coach confirms the player is now available.
 */
export async function clearMatchAbsence(
  matchId: string,
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<MatchAbsenceResult> {
  const report = await db.postMatchReport.findFirst({ where: { matchId, ...orgFilter.filter } });
  if (!report) return { success: false, error: "No report exists for this match." };
  if (isReportLocked(report.status)) {
    return { success: false, error: "Cannot change absence: report is locked. Reopen it first." };
  }

  const absence = await db.matchReportAbsence.findFirst({
    where: { matchReportId: report.id, playerId },
  });
  if (absence) {
    await db.matchReportAbsence.delete({ where: { id: absence.id } });
  }

  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { matchRoundId: true },
  });

  let restoredStatus: PostMatchAttendanceStatus = "UNKNOWN";

  if (match) {
    const availability = await db.availability.findFirst({
      where: { playerId, matchRoundId: match.matchRoundId },
      select: { status: true },
    });

    if (availability) {
      if (availability.status === "AVAILABLE" || availability.status === "TENTATIVE") {
        restoredStatus = "PRESENT";
      } else if (availability.status === "UNAVAILABLE" || availability.status === "INJURED" || availability.status === "SICK" || availability.status === "AWAY") {
        restoredStatus = "NO_SHOW";
      }
    }
  }

  await db.postMatchPlayerActual.updateMany({
    where: { reportId: report.id, playerId, attendanceStatus: "NO_SHOW" },
    data: { attendanceStatus: restoredStatus },
  });

  return { success: true, matchId, reportId: report.id };
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
    const { buildLeagueMatchRef } = await import("@/lib/evidence/adapters/league-evidence-adapter");
    const { runPostMatchLearning } = await import("@/lib/evidence/post-match-learning");
    const ref = await buildLeagueMatchRef(report.matchId);
    await runPostMatchLearning(ref, ctx.orgFilter);
  } catch {
    // Post-match learning (opponent/player/combination evidence) must not block report
    // completion — see ADR-0104. Failures are surfaced via runPostMatchLearning's own
    // structured result to callers that want it, not by throwing here.
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