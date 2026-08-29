import { db } from "@/lib/db";
import type { MatchReportStatus } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { canTransitionTo, hasUnknownAttendance } from "./report-domain";

export type SeedEventReportFromLiveSessionResult =
  | { success: true; eventMatchId: string; reportId: string; status: MatchReportStatus; alreadyExisted: boolean }
  | { success: false; error: string };

/**
 * Event-side Run -> Learn handoff (ADR-0088), parallel to
 * `seedReportFromLiveSession()` in `report-mutations.ts` for League matches. Event and League
 * reporting are deliberately separate models (AGENTS.md) with different schemas
 * (`EventPostMatchReport`/`playerReports` vs `PostMatchReport`/`playerActuals`), so this is not
 * a duplicate to merge with the League function — it is the Event domain's own owning
 * implementation, extracted out of the server action that previously reimplemented it inline.
 * The caller (`endEventLiveSessionAndCreateReportAction`) validates session/match/organisation
 * consistency before calling this — `organisationId` here is trusted, not re-derived.
 */
export async function seedEventReportFromLiveSession(
  eventMatchId: string,
  organisationId: string,
): Promise<SeedEventReportFromLiveSessionResult> {
  const existingReport = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
    select: { id: true, status: true },
  });

  if (existingReport) {
    return {
      success: true,
      eventMatchId,
      reportId: existingReport.id,
      status: existingReport.status,
      alreadyExisted: true,
    };
  }

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    select: {
      eventId: true,
      eventSquadId: true,
      eventSquad: {
        select: {
          id: true,
          name: true,
          players: {
            select: {
              playerId: true,
              assignedRoleType: true,
              source: true,
            },
          },
        },
      },
    },
  });

  if (!eventMatch) {
    return { success: false, error: "Event match not found." };
  }

  const supportAssignments = await db.eventMatchSupportAssignment.findMany({
    where: { eventMatchId },
    select: { playerId: true, plannedRole: true },
  });

  // ADR-0106: EventSquadPlayer.playerId/EventMatchSupportAssignment.playerId are now nullable
  // (a GuestPlayer participant uses guestPlayerId instead). GuestPlayer participation is not yet
  // wired into this seeding path (Event GuestPlayer integration is a later, separate change) --
  // filtering nulls here is a no-op today (no write path produces one yet) and keeps this
  // function's existing Player-only behaviour unchanged in the meantime.
  const squadPlayerIds = new Set(
    eventMatch.eventSquad.players.map((sp) => sp.playerId).filter((id): id is string => id !== null),
  );
  const allPlayerIds = new Set<string>([
    ...squadPlayerIds,
    ...supportAssignments.map((sa) => sa.playerId).filter((id): id is string => id !== null),
  ]);

  const supportPlayerRoles = new Map<string, string>();
  for (const sa of supportAssignments) {
    if (sa.plannedRole && sa.playerId) {
      supportPlayerRoles.set(sa.playerId, sa.plannedRole);
    }
  }

  const liveEvents = await db.eventLiveMatchEvent.findMany({
    where: {
      eventMatchId,
      OR: [
        { correctionType: null },
        { correctionType: "CORRECTION" },
      ],
      eventType: { in: ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET"] },
    },
    select: {
      eventType: true,
      playerId: true,
      secondaryPlayerId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const goalsFor = liveEvents.filter((e) => e.eventType === "GOAL_FOR").length;
  const goalsAgainst = liveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length;

  const scorerEvents = liveEvents.filter((e) => e.eventType === "SCORER_SET" && e.playerId !== null);
  const assistEvents = liveEvents.filter((e) => e.eventType === "ASSIST_SET" && e.playerId !== null);

  const report = await db.eventPostMatchReport.create({
    data: {
      eventMatchId,
      status: "DRAFT",
      ourScore: goalsFor,
      opponentScore: goalsAgainst,
      organisationId,
      playerReports: {
        create: Array.from(allPlayerIds).map((playerId) => ({
          playerId,
          attendanceStatus: "PRESENT",
          role: supportPlayerRoles.get(playerId) ?? undefined,
          organisationId,
        })),
      },
      goalEvents: {
        create: scorerEvents.map((e) => ({
          playerId: e.playerId!,
          type: "NORMAL",
          organisationId,
        })),
      },
      assistEvents: {
        create: assistEvents.map((e) => ({
          playerId: e.playerId!,
          type: "NORMAL",
          organisationId,
        })),
      },
    },
  });

  return {
    success: true,
    eventMatchId,
    reportId: report.id,
    status: report.status,
    alreadyExisted: false,
  };
}

export type CompleteEventReportResult =
  | { success: true; eventMatchId: string }
  | { success: false; error: string };

/**
 * Event-side completion transition (DRAFT/REPORTED -> LOCKED), owning what
 * `completeEventMatchReportAction` previously reimplemented inline (ARR-0030). Reuses
 * League's `canTransitionTo`/`hasUnknownAttendance` from `report-domain.ts` directly --
 * verified reusable as-is (ARR-0030's own containment note said not to assume this
 * without checking): both operate purely on the shared `MatchReportStatus` enum and a
 * generic `{ attendanceStatus: string }[]` shape, and Event's actual completion pattern
 * (DRAFT or REPORTED -> LOCKED directly, no separate submit step) is already exactly
 * what `canTransitionTo`'s existing transition table allows.
 *
 * After the status write, resolves opponent identity and runs the shared post-match
 * learning pipeline (ADR-0104) -- the same `runPostMatchLearning()` League's
 * `completeReport()` calls, not a second implementation.
 */
export async function completeEventReport(
  reportId: string,
  orgFilter: OrgFilterMode,
): Promise<CompleteEventReportResult> {
  const report = await db.eventPostMatchReport.findFirst({
    where: { id: reportId, ...orgFilter.filter },
    include: { playerReports: true },
  });

  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, "LOCKED").allowed) {
    return { success: false, error: "Only DRAFT or REPORTED reports can be completed." };
  }

  if (hasUnknownAttendance(report.playerReports)) {
    return {
      success: false,
      error: "Cannot complete report: some players have unknown attendance. Mark all players as Present, No show, or absent.",
    };
  }

  await db.eventPostMatchReport.update({
    where: { id: reportId },
    data: { status: "LOCKED" as MatchReportStatus, completedAt: new Date() },
  });

  const { resolveEventOpponentOnReportCompletion } = await import("@/lib/opponents/resolve-opponent");
  await resolveEventOpponentOnReportCompletion(report.eventMatchId);

  try {
    const { buildEventMatchRef } = await import("@/lib/evidence/adapters/event-evidence-adapter");
    const { runPostMatchLearning } = await import("@/lib/evidence/post-match-learning");
    const ref = await buildEventMatchRef(report.eventMatchId);
    await runPostMatchLearning(ref, orgFilter);
  } catch {
    // Post-match learning (opponent/player/combination evidence) must not block report
    // completion -- see ADR-0104, mirrors League's completeReport().
  }

  return { success: true, eventMatchId: report.eventMatchId };
}
