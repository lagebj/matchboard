"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { endLiveSession } from "@/lib/live-match/live-match-session";
import { seedReportFromLiveSession } from "@/lib/reports/report-mutations";

/**
 * Run -> Learn handoff adapter (ADR-0088): validates session/match/organisation consistency for
 * this specific server-action entry point, then delegates the two owning transitions —
 * "this live session ends" and "the first DRAFT post-match report exists" — to their domain
 * functions instead of reimplementing either write here.
 */
export async function endLiveSessionAndCreateReportAction(sessionId: string, matchId: string) {
  try {
    const ctx = await requirePageActorContext();
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

    if (session.organisationId !== ctx.organisationId) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    await requireMatchGroupAccess(ctx, matchId);

    await endLiveSession(sessionId);

    const result = await seedReportFromLiveSession(matchId, session.organisationId);
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return {
      success: true as const,
      data: {
        sessionId,
        matchId,
        reportId: result.reportId,
        reportStatus: result.status,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to end session and create report.",
    };
  }
}
