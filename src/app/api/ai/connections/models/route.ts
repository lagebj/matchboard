import { NextResponse } from "next/server";
import { requireActorContext, requireOwnerRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { safeErrorResponse } from "@/lib/security/errors";
import { getProviderConnection } from "@/lib/ai/provider-connections";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";
import { db } from "@/lib/db";

const REFRESHABLE_STATUSES = new Set(["CONNECTED_NO_MODEL", "READY", "ERROR"]);

/**
 * POST /api/ai/connections/models (04_ORG_CONNECTION_FLOW.md "Refresh-models endpoint").
 *
 * Owner-only, explicit action only (never a page-load fetch — the owner must click "Refresh
 * models"). Returns safe model IDs/display metadata only, same as `/complete`. A transient
 * refresh failure never changes the connection's own status (04_ORG_CONNECTION_FLOW.md:
 * "Transient failures must not be converted to `PROVIDER_AUTH_FAILED`") — only
 * `lastValidatedAt`/`lastErrorCode` bookkeeping is updated, never `status`, since a `READY`
 * connection stays usable for review execution even if a later refresh call fails.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireOwnerRole(ctx);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const connectionId = (body as { connectionId?: unknown } | null)?.connectionId;
    if (typeof connectionId !== "string" || connectionId.length === 0) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    const connection = await getProviderConnection(ctx.organisationId, connectionId);
    if (!connection || !REFRESHABLE_STATUSES.has(connection.status)) {
      return NextResponse.json({ error: "No connection found for this ID" }, { status: 404 });
    }

    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const adapter = getProviderAdapter(providerWireId);

    let listResult: Awaited<ReturnType<typeof adapter.listModels>>;
    try {
      listResult = await withProviderCredential(connectionId, (credential) => adapter.listModels(credential));
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { lastErrorCode: errorCode } });
      return NextResponse.json({ error: "Failed to refresh the model catalogue", errorCode }, { status: 502 });
    }

    if (!listResult.ok) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { lastErrorCode: listResult.errorCode } });
      return NextResponse.json({ error: "Failed to refresh the model catalogue", errorCode: listResult.errorCode }, { status: 502 });
    }

    await db.aiProviderConnection.update({ where: { id: connectionId }, data: { lastValidatedAt: new Date(), lastErrorCode: null } });

    return NextResponse.json({ connectionId, models: listResult.models });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
