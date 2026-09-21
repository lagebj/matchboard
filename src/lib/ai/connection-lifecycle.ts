import "server-only";
import { db } from "@/lib/db";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { signDeleteConnectionToken } from "@/lib/ai/enrollment-token";
import { getMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";
import { logger } from "@/lib/logger";

/**
 * Shared "retire a `DELETE_PENDING` connection" step (04_ORG_CONNECTION_FLOW.md "Disconnect" /
 * "Replace API key"), used by every caller that marks a connection `DELETE_PENDING`: the
 * select-model route's replace-key finalization, the disconnect route, and the connection
 * maintenance worker's retry sweep (`jobs/connection-maintenance.ts`). A single shared
 * implementation so all three can never drift on how a delete failure is handled.
 *
 * Best-effort: a transient failure here is never surfaced as an error to whichever caller
 * triggered it (the organisation-facing state change — activeConnectionId cleared/reassigned —
 * has already happened); the connection is simply left `DELETE_PENDING` for the maintenance
 * worker's next retry sweep. Silently returns if the connection no longer exists or has already
 * left `DELETE_PENDING` (a concurrent retry already handled it).
 */
export async function attemptRetireConnection(organisationId: string, connectionId: string): Promise<void> {
  const connection = await db.aiProviderConnection.findFirst({ where: { id: connectionId, organisationId } });
  if (!connection || connection.status !== "DELETE_PENDING") return;

  try {
    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const deleteToken = await signDeleteConnectionToken({ connectionId, provider: providerWireId });
    const transport = getMatchboardSecurityTransport();
    const result = await transport.deleteConnection({ connectionId, provider: providerWireId, deleteToken });
    if (result.ok) {
      await db.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "DISCONNECTED", disconnectedAt: new Date() } });
    } else {
      logger.warn({ connectionId, errorCode: result.errorCode }, "[ai/connection-lifecycle] Retiring connection failed; left DELETE_PENDING for retry");
    }
  } catch (error) {
    logger.warn({ err: error, connectionId }, "[ai/connection-lifecycle] Retiring connection threw; left DELETE_PENDING for retry");
  }
}
