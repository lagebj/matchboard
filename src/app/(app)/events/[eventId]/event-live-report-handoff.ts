"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { endEventLiveSession } from "@/lib/live-match/event-live-match-session";
import { seedEventReportFromLiveSession } from "@/lib/reports/event-report-mutations";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

async function requireEventMatchOrgAccess(eventMatchId: string): Promise<{ eventId: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: ctx.orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error("Event match not found or access denied.");
  return { eventId: match.eventId };
}

/**
 * Event-side Run -> Learn handoff adapter (ADR-0088), parallel to
 * `endLiveSessionAndCreateReportAction` for League matches: validates session/match/organisation
 * consistency for this entry point, then delegates the two owning transitions — "this live
 * session ends" and "the first DRAFT event post-match report exists" — to their domain
 * functions instead of reimplementing either write here.
 */
export async function endEventLiveSessionAndCreateReportAction(sessionId: string, eventMatchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
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

    if (session.organisationId !== ctx.orgFilter.organisationId) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    await endEventLiveSession(sessionId);

    const result = await seedEventReportFromLiveSession(eventMatchId, session.organisationId);
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    const { eventId } = await requireEventMatchOrgAccess(eventMatchId);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/matches/${eventMatchId}/live`);

    return {
      success: true as const,
      data: {
        sessionId,
        eventMatchId,
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
