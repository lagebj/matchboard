import { NextResponse } from "next/server";
import { requireActorContext, requireOwnerRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { safeErrorResponse } from "@/lib/security/errors";
import { getOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { attemptRetireConnection } from "@/lib/ai/connection-lifecycle";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { db } from "@/lib/db";

/**
 * POST /api/ai/connections/disconnect (04_ORG_CONNECTION_FLOW.md "Disconnect").
 *
 * Owner-only. Disconnect sequence:
 * 1. clear `OrganisationAiSettings.activeConnectionId` and mark the connection `DELETE_PENDING`
 *    in one transaction — this alone blocks all new AI execution (every capability's job
 *    trigger/view-model builder already requires `settings.activeConnectionId` to be set), so
 *    the organisation is disconnected from this response's perspective regardless of what
 *    happens next;
 * 2. best-effort call the signed matchboard-security delete operation
 *    (`attemptRetireConnection`) — on success the connection is marked `DISCONNECTED`; on a
 *    transient failure it is left `DELETE_PENDING` for the maintenance worker's retry sweep
 *    (`jobs/connection-maintenance.ts`), never surfaced as an error here.
 *
 * The master `enabled` switch is deliberately left untouched (04_ORG_CONNECTION_FLOW.md "AI
 * enablement": "Connection and AI enablement are separate.") — re-connecting later resumes
 * whatever capabilities were already enabled without the owner needing to re-toggle them.
 * Historical `AiAdvisorReview` rows are untouched (`providerConnectionId` is `onDelete: SetNull`,
 * never cascaded) — "do not delete historical AI review text solely because a key was
 * disconnected."
 */
export async function POST() {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireOwnerRole(ctx);

    const settings = await getOrganisationAiSettings(ctx.organisationId);
    if (!settings?.activeConnectionId) {
      return NextResponse.json({ error: "No active connection to disconnect" }, { status: 404 });
    }
    const connectionId = settings.activeConnectionId;

    await db.$transaction(async (tx) => {
      await tx.organisationAiSettings.update({
        where: { organisationId: ctx.organisationId },
        data: { activeConnectionId: null },
      });
      await tx.aiProviderConnection.update({
        where: { id: connectionId },
        data: { status: "DELETE_PENDING" },
      });
    });

    await attemptRetireConnection(ctx.organisationId, connectionId);

    logSecurityEvent({
      category: "mutation",
      action: "disconnect_ai_provider_connection",
      actor: ctx.userId,
      tenant: ctx.organisationId,
      resource: "ai_provider_connection",
      resourceId: connectionId,
      result: "success",
    });

    return NextResponse.json({ status: "disconnected" });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
