import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { triggerAiCapability } from "@/lib/ai/jobs/triggers";

/**
 * Cron-scheduled discovery for capabilities with no domain-mutation trigger
 * (07_EXECUTION_PIPELINE.md "Domain triggers": "Match preparation and weekly review are
 * cron-scheduled" / "A worker run: 1. enqueues due match preparation jobs; 2. enqueues
 * previous-week team reviews; 3. claims eligible jobs atomically ..."). Called from the
 * `/api/cron/ai` route before `processAiJobsBatch()` claims and executes the queue.
 *
 * Scans every organisation's fixtures (cross-tenant by nature — a cron sweep, not a
 * single-tenant request — hence `runWithSystemPrivilege`), then re-enters a per-organisation
 * tenant context for each match before calling `triggerAiCapability`, matching the runner's own
 * `runWithTenantOrganisationId(job.organisationId, ...)` convention for cross-tenant workers.
 * `triggerAiCapability` itself still re-checks AI/capability enablement, domain eligibility (a
 * complete plan exists — `match-prep.ts`'s `buildContext`), and the fingerprint/dedup rule before
 * enqueueing anything, so this scan only needs to supply the *candidate* scope, not re-derive
 * eligibility.
 */
const MATCH_PREP_WINDOW_HOURS = 24;

export async function enqueueDueMatchPrepJobs(): Promise<{ scanned: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + MATCH_PREP_WINDOW_HOURS * 60 * 60 * 1000);

  const dueMatches = await runWithSystemPrivilege("ai-match-prep-scan", () =>
    db.match.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: now, lte: windowEnd } },
      select: { id: true, organisationId: true },
    }),
  );

  for (const match of dueMatches) {
    try {
      await runWithTenantOrganisationId(match.organisationId, () =>
        triggerAiCapability({
          organisationId: match.organisationId,
          capability: "MATCH_PREP",
          scopeType: "MATCH",
          scopeId: match.id,
        }),
      );
    } catch (error) {
      // triggerAiCapability itself never throws (it logs and swallows) — this catch is
      // defensive only, so one match's unexpected failure can never abort the whole scan.
      logger.warn({ err: error, matchId: match.id, organisationId: match.organisationId }, "[ai/jobs/scheduled-triggers] Failed to enqueue match_prep");
    }
  }

  return { scanned: dueMatches.length };
}
