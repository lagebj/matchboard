"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";

async function requireEventMatchOrgAccess(eventMatchId: string): Promise<{ eventId: string }> {
  const ctx = await requireActorContext();
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: ctx.orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error("Event match not found or access denied.");
  return { eventId: match.eventId };
}

export async function endEventLiveSessionAndCreateReportAction(sessionId: string, eventMatchId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, organisationId: ctx.orgFilter.organisationId },
      select: { id: true, eventMatchId: true, status: true, organisationId: true },
    });

    if (!session) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    if (session.status !== "ACTIVE") {
      return { success: false as const, error: "Session is not active." };
    }

    if (session.eventMatchId !== eventMatchId) {
      return { success: false as const, error: "Session does not belong to this event match." };
    }

    const eventMatch = await db.eventMatch.findFirst({
      where: { id: eventMatchId, event: ctx.orgFilter.filter },
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
      return { success: false as const, error: "Event match not found." };
    }

    await db.eventLiveMatchSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    const existingReport = await db.eventPostMatchReport.findFirst({
      where: { eventMatchId, eventMatch: { event: ctx.orgFilter.filter } },
      select: { id: true, status: true },
    });

    let reportResult: { id: string; status: string; eventMatchId: string };

    if (existingReport) {
      reportResult = {
        id: existingReport.id,
        status: existingReport.status,
        eventMatchId,
      };
    } else {
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
          organisationId: session.organisationId,
          playerReports: {
            create: Array.from(allPlayerIds).map((playerId) => ({
              playerId,
              attendanceStatus: "PRESENT",
              role: supportPlayerRoles.get(playerId) ?? undefined,
              organisationId: session.organisationId,
            })),
          },
          goalEvents: {
            create: scorerEvents.map((e) => ({
              playerId: e.playerId!,
              type: "NORMAL",
              organisationId: session.organisationId,
            })),
          },
          assistEvents: {
            create: assistEvents.map((e) => ({
              playerId: e.playerId!,
              type: "NORMAL",
              organisationId: session.organisationId,
            })),
          },
        },
      });

      reportResult = {
        id: report.id,
        status: report.status,
        eventMatchId: report.eventMatchId,
      };
    }

    const { eventId } = await requireEventMatchOrgAccess(eventMatchId);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/matches/${eventMatchId}/live`);

    return {
      success: true as const,
      data: {
        sessionId,
        eventMatchId,
        reportId: reportResult.id,
        reportStatus: reportResult.status,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to end session and create report.",
    };
  }
}