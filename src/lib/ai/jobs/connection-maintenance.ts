import "server-only";
import { db } from "@/lib/db";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { attemptRetireConnection } from "@/lib/ai/connection-lifecycle";
import { logger } from "@/lib/logger";

/**
 * The internal AI maintenance worker (04_ORG_CONNECTION_FLOW.md "Disconnect" step 5: "on
 * transient deletion failure keep `DELETE_PENDING` and retry from the internal AI maintenance
 * worker"). Called from the `/api/cron/ai` route alongside the job-enqueue scans.
 *
 * Cross-tenant by nature — a cron sweep across every organisation's `DELETE_PENDING`
 * connections, not a single-tenant request — hence `runWithSystemPrivilege`, then re-entering a
 * per-organisation tenant context for each retry attempt, matching
 * `enqueueDueWeeklyTeamReviewJobs()`'s own convention (`jobs/scheduled-triggers.ts`).
 * `attemptRetireConnection` itself re-checks the connection is still `DELETE_PENDING` before
 * doing anything (defence against a concurrent retry already finishing it) and never throws.
 */
export async function retryPendingConnectionDeletions(): Promise<{ scanned: number }> {
  const pending = await runWithSystemPrivilege("ai-connection-delete-retry-scan", () =>
    db.aiProviderConnection.findMany({
      where: { status: "DELETE_PENDING" },
      select: { id: true, organisationId: true },
    }),
  );

  for (const connection of pending) {
    try {
      await runWithTenantOrganisationId(connection.organisationId, () =>
        attemptRetireConnection(connection.organisationId, connection.id),
      );
    } catch (error) {
      // attemptRetireConnection itself never throws — this catch is defensive only, so one
      // connection's unexpected failure can never abort the whole sweep.
      logger.warn(
        { err: error, connectionId: connection.id, organisationId: connection.organisationId },
        "[ai/jobs/connection-maintenance] Failed to retry connection deletion",
      );
    }
  }

  return { scanned: pending.length };
}
