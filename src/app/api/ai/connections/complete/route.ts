import { NextResponse } from "next/server";
import { requireActorContext, requireOwnerRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { safeErrorResponse } from "@/lib/security/errors";
import { getProviderConnection } from "@/lib/ai/provider-connections";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";
import { db } from "@/lib/db";

/**
 * POST /api/ai/connections/complete (04_ORG_CONNECTION_FLOW.md "Complete endpoint").
 *
 * Owner-only. Called by the browser once it has submitted the credential directly to
 * matchboard-security (never through this or any other Matchboard route). Retrieves the
 * credential just-in-time via `withProviderCredential`, calls the adapter's `listModels()`, and
 * transitions the connection to `CONNECTED_NO_MODEL` only if at least one usable model came
 * back — otherwise the connection moves to `ERROR` with a normalized error code, never the raw
 * credential/account metadata.
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
    if (!connection || connection.status !== "PENDING") {
      // Never distinguishes "not found" from "wrong organisation" from "wrong status" in the
      // response — same non-disclosure rule `getProviderConnection` itself documents.
      return NextResponse.json({ error: "No pending connection found for this ID" }, { status: 404 });
    }

    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const adapter = getProviderAdapter(providerWireId);

    let listResult: Awaited<ReturnType<typeof adapter.listModels>>;
    try {
      listResult = await withProviderCredential(connectionId, (credential) => adapter.listModels(credential));
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastErrorCode: errorCode } });
      return NextResponse.json({ error: "Failed to validate the provider credential", errorCode }, { status: 502 });
    }

    if (!listResult.ok) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastErrorCode: listResult.errorCode } });
      return NextResponse.json({ error: "Failed to validate the provider credential", errorCode: listResult.errorCode }, { status: 502 });
    }

    if (listResult.models.length === 0) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastErrorCode: "PROVIDER_MODEL_LIST_EMPTY" } });
      return NextResponse.json({ error: "Provider returned no usable models", errorCode: "PROVIDER_MODEL_LIST_EMPTY" }, { status: 502 });
    }

    const now = new Date();
    await db.aiProviderConnection.update({
      where: { id: connectionId },
      data: { status: "CONNECTED_NO_MODEL", connectedAt: now, lastValidatedAt: now, lastErrorCode: null },
    });

    return NextResponse.json({
      connectionId,
      status: "CONNECTED_NO_MODEL",
      models: listResult.models,
    });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
