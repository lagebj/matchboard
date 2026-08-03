"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireMatchTeamAccess } from "@/lib/auth/actor-context";

export async function endLiveSessionAndCreateReportAction(sessionId: string, matchId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const session = await db.liveMatchSession.findUnique({
      where: { id: sessionId },
      select: { id: true, matchId: true, status: true, organisationId: true },
    });

    if (!session) {
      return { success: false as const, error: "Session not found." };
    }

    if (session.status !== "ACTIVE") {
      return { success: false as const, error: "Session is not active." };
    }

    if (session.matchId !== matchId) {
      return { success: false as const, error: "Session does not belong to this match." };
    }

    if (ctx.orgFilter.type === "org" && session.organisationId !== ctx.orgFilter.organisationId) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    await requireMatchTeamAccess(ctx, matchId);

    await db.liveMatchSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    const existingReport = await db.postMatchReport.findUnique({
      where: { matchId },
      select: { id: true, status: true },
    });

    let reportResult: { id: string; status: string; matchId: string };

    if (existingReport) {
      reportResult = {
        id: existingReport.id,
        status: existingReport.status,
        matchId,
      };
    } else {
      const selections = await db.selection.findMany({
        where: { matchId, status: "FINALIZED" },
        select: { playerId: true },
      });

      const report = await db.postMatchReport.create({
        data: {
          matchId,
          status: "DRAFT",
          homeGoals: 0,
          awayGoals: 0,
          organisationId: session.organisationId,
          playerActuals: {
            create: selections.map((s) => ({
              matchId,
              playerId: s.playerId,
              source: "PLANNED",
              attendanceStatus: "UNKNOWN",
              organisationId: session.organisationId,
            })),
          },
        },
      });

      reportResult = {
        id: report.id,
        status: report.status,
        matchId: report.matchId,
      };
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return {
      success: true as const,
      data: {
        sessionId,
        matchId,
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