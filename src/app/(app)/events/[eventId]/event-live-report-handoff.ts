"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";

export async function endEventLiveSessionAndCreateReportAction(sessionId: string, eventMatchId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const session = await db.eventLiveMatchSession.findUnique({
      where: { id: sessionId },
      select: { id: true, eventMatchId: true, status: true, organisationId: true },
    });

    if (!session) {
      return { success: false as const, error: "Session not found." };
    }

    if (session.status !== "ACTIVE") {
      return { success: false as const, error: "Session is not active." };
    }

    if (session.eventMatchId !== eventMatchId) {
      return { success: false as const, error: "Session does not belong to this event match." };
    }

    if (ctx.orgFilter.type === "org" && session.organisationId !== ctx.orgFilter.organisationId) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    const eventMatch = await db.eventMatch.findUnique({
      where: { id: eventMatchId },
      select: { eventId: true, eventSquadId: true },
    });

    if (!eventMatch) {
      return { success: false as const, error: "Event match not found." };
    }

    await db.eventLiveMatchSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    const existingReport = await db.eventPostMatchReport.findUnique({
      where: { eventMatchId },
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
      const squadPlayers = await db.eventSquadPlayer.findMany({
        where: { eventSquadId: eventMatch.eventSquadId },
        select: { playerId: true },
      });

      const supportAssignments = await db.eventMatchSupportAssignment.findMany({
        where: { eventMatchId },
        select: { playerId: true },
      });

      const playerIds = new Set<string>([
        ...squadPlayers.map((sp) => sp.playerId),
        ...supportAssignments.map((sa) => sa.playerId),
      ]);

      const report = await db.eventPostMatchReport.create({
        data: {
          eventMatchId,
          status: "DRAFT",
          ourScore: 0,
          opponentScore: 0,
          organisationId: session.organisationId,
          playerReports: {
            create: Array.from(playerIds).map((playerId) => ({
              playerId,
              attendanceStatus: "UNKNOWN",
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

    revalidatePath(`/events/${eventMatch.eventId}`);
    revalidatePath(`/events/${eventMatch.eventId}/matches/${eventMatchId}/live`);

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