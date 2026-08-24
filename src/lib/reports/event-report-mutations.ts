import { db } from "@/lib/db";
import type { MatchReportStatus } from "@/generated/prisma/client";

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

  const squadPlayerIds = new Set(eventMatch.eventSquad.players.map((sp) => sp.playerId));
  const allPlayerIds = new Set<string>([
    ...squadPlayerIds,
    ...supportAssignments.map((sa) => sa.playerId),
  ]);

  const supportPlayerRoles = new Map<string, string>();
  for (const sa of supportAssignments) {
    if (sa.plannedRole) {
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
