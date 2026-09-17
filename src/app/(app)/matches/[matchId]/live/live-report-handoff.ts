"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { finishLiveReporting } from "@/lib/live-match/finish-live-reporting";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * Run -> Learn handoff adapter (ADR-0088/ADR-0146): validates session/match/organisation
 * consistency and authorization for this specific server-action entry point, then delegates the
 * actual completion — "this live session ends, any still-active period is resolved, the first
 * DRAFT post-match report exists" — to the one shared `finishLiveReporting` operation
 * (ADR-0146 §5/D11) also used by the automatic timeout path (slice 4), rather than
 * reimplementing any of it here.
 */
export async function endLiveSessionAndCreateReportAction(sessionId: string, matchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
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

    const ref = await buildLeagueMatchRef(matchId);
    const result = await finishLiveReporting(ref, "MANUAL", { organisationId: session.organisationId });

    if (!result.reportId || !result.reportStatus) {
      return { success: false as const, error: "Failed to end session and create report." };
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
        reportStatus: result.reportStatus,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to end session and create report.",
    };
  }
}
