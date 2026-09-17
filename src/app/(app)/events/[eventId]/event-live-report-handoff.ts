"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireGroupMutationRoleFromContext } from "@/lib/auth/actor-context";
import { finishLiveReporting } from "@/lib/live-match/finish-live-reporting";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

// Takes an already-resolved `orgFilter` rather than resolving its own actor context — see
// event-live-actions.ts's requireEventMatchOrgAccess for why a helper resolving its own context
// internally is unsafe for a caller that queries again afterward (ARR-0029 "Bug 3", ADR-0087).
async function requireEventMatchOrgAccess(eventMatchId: string, orgFilter: OrgFilterMode): Promise<{ eventId: string }> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, organisationId: orgFilter.organisationId },
    select: { eventId: true },
  });
  if (!match) throw new Error("Event match not found or access denied.");
  return { eventId: match.eventId };
}

/**
 * Event-side Run -> Learn handoff adapter (ADR-0088/ADR-0146), parallel to
 * `endLiveSessionAndCreateReportAction` for League matches: validates session/match/organisation
 * consistency and authorization for this entry point, then delegates the actual completion to
 * the one shared `finishLiveReporting` operation (ADR-0146 §5/D11) also used by the automatic
 * timeout path (slice 4), rather than reimplementing any of it here.
 *
 * ADR-0140 — group mutation authority is required BEFORE either transition. A `GROUP_VIEWER`
 * must not be able to complete the live-to-report handoff.
 */
export async function endEventLiveSessionAndCreateReportAction(sessionId: string, eventMatchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, organisationId: ctx.orgFilter.organisationId },
      select: {
        id: true,
        eventMatchId: true,
        status: true,
        organisationId: true,
        eventMatch: { select: { event: { select: { footballGroupId: true } } } },
      },
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

    requireGroupMutationRoleFromContext(ctx, session.eventMatch.event.footballGroupId);

    const ref = await buildEventMatchRef(eventMatchId);
    const result = await finishLiveReporting(ref, "MANUAL", { organisationId: session.organisationId });

    if (!result.reportId || !result.reportStatus) {
      return { success: false as const, error: "Failed to end session and create report." };
    }

    const { eventId } = await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/matches/${eventMatchId}/live`);

    return {
      success: true as const,
      data: {
        sessionId,
        eventMatchId,
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
