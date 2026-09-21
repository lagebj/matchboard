import { NextResponse } from "next/server";
import { requireActorContext, requireOwnerRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { safeErrorResponse } from "@/lib/security/errors";
import { getProviderConnection } from "@/lib/ai/provider-connections";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";
import { ensureOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { signDeleteConnectionToken } from "@/lib/ai/enrollment-token";
import { getMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const SELECTABLE_STATUSES = new Set(["CONNECTED_NO_MODEL", "READY", "ERROR"]);

/**
 * POST /api/ai/connections/select-model (04_ORG_CONNECTION_FLOW.md "Model selection endpoint" /
 * "Change model" / "Replace API key" step 6 — "switch `activeConnectionId` only after new
 * connection is `READY`").
 *
 * Owner-only. Re-fetches the model catalogue itself (never trusts a browser-supplied model ID
 * without cross-checking it against a fresh `listModels()` result) and only persists the model
 * and moves the connection to `READY` after a successful `probeModel()`. A failed probe never
 * changes the connection's existing model — "keep old active model" for `READY` connections,
 * "keep model unselected" for a first-time `CONNECTED_NO_MODEL` selection.
 *
 * When this connection was not already the organisation's active one (first-time connect, or a
 * `replace-key` connection reaching `READY` for the first time), promotes it to
 * `OrganisationAiSettings.activeConnectionId` and retires whatever connection was active before
 * (04_ORG_CONNECTION_FLOW.md "Replace API key" steps 6-9) — the same promotion path covers both
 * flows, since a first-time connect always has no prior active connection to retire.
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
    const model = (body as { model?: unknown } | null)?.model;
    if (typeof connectionId !== "string" || connectionId.length === 0) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }
    if (typeof model !== "string" || model.length === 0) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const connection = await getProviderConnection(ctx.organisationId, connectionId);
    if (!connection || !SELECTABLE_STATUSES.has(connection.status)) {
      return NextResponse.json({ error: "No selectable connection found for this ID" }, { status: 404 });
    }

    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const adapter = getProviderAdapter(providerWireId);

    let listResult: Awaited<ReturnType<typeof adapter.listModels>>;
    try {
      listResult = await withProviderCredential(connectionId, (credential) => adapter.listModels(credential));
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      return NextResponse.json({ error: "Failed to refresh the model catalogue", errorCode }, { status: 502 });
    }
    if (!listResult.ok) {
      return NextResponse.json({ error: "Failed to refresh the model catalogue", errorCode: listResult.errorCode }, { status: 502 });
    }
    if (!listResult.models.some((m) => m.id === model)) {
      return NextResponse.json({ error: "Selected model is not in the current catalogue" }, { status: 400 });
    }

    let probeResult: Awaited<ReturnType<typeof adapter.probeModel>>;
    try {
      probeResult = await withProviderCredential(connectionId, (credential) => adapter.probeModel(credential, model));
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { lastErrorCode: errorCode } });
      return NextResponse.json({ error: "Model compatibility check failed", errorCode }, { status: 502 });
    }
    if (!probeResult.ok) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { lastErrorCode: probeResult.errorCode } });
      return NextResponse.json({ error: "Model compatibility check failed", errorCode: probeResult.errorCode }, { status: 502 });
    }

    const now = new Date();
    const settings = await ensureOrganisationAiSettings(ctx.organisationId);
    const previousActiveConnectionId =
      settings.activeConnectionId && settings.activeConnectionId !== connectionId ? settings.activeConnectionId : null;

    await db.$transaction(async (tx) => {
      await tx.aiProviderConnection.update({
        where: { id: connectionId },
        data: { model, status: "READY", readyAt: now, lastValidatedAt: now, lastErrorCode: null },
      });
      await tx.organisationAiSettings.update({
        where: { organisationId: ctx.organisationId },
        data: { activeConnectionId: connectionId },
      });
      if (previousActiveConnectionId) {
        await tx.aiProviderConnection.update({
          where: { id: previousActiveConnectionId },
          data: { status: "DELETE_PENDING" },
        });
      }
    });

    if (previousActiveConnectionId) {
      await retireConnection(ctx.organisationId, previousActiveConnectionId);
    }

    return NextResponse.json({ connectionId, status: "READY", model });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

/**
 * Best-effort immediate retirement of a connection just marked `DELETE_PENDING` — a transient
 * failure here is not surfaced to the caller (the new connection is already active and usable);
 * it is left `DELETE_PENDING` for the internal AI maintenance worker's retry sweep
 * (`jobs/connection-maintenance.ts`, a later PR) to finish.
 */
async function retireConnection(organisationId: string, connectionId: string): Promise<void> {
  const connection = await db.aiProviderConnection.findFirst({ where: { id: connectionId, organisationId } });
  if (!connection) return;

  try {
    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const deleteToken = await signDeleteConnectionToken({ connectionId, provider: providerWireId });
    const transport = getMatchboardSecurityTransport();
    const result = await transport.deleteConnection({ connectionId, provider: providerWireId, deleteToken });
    if (result.ok) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "DISCONNECTED", disconnectedAt: new Date() } });
    } else {
      logger.warn({ connectionId, errorCode: result.errorCode }, "[ai/connections/select-model] Retiring old connection failed; left DELETE_PENDING for retry");
    }
  } catch (error) {
    logger.warn({ err: error, connectionId }, "[ai/connections/select-model] Retiring old connection threw; left DELETE_PENDING for retry");
  }
}
