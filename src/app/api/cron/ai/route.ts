import { NextResponse } from "next/server";
import "@/lib/ai/register-capabilities";
import { processAiJobsBatch } from "@/lib/ai/jobs/runner";
import { enqueueDueMatchPrepJobs, enqueueDueWeeklyTeamReviewJobs } from "@/lib/ai/jobs/scheduled-triggers";
import { retryPendingConnectionDeletions } from "@/lib/ai/jobs/connection-maintenance";
import { getCronSecret } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * The AI job cron route (07_EXECUTION_PIPELINE.md "Queue" — recommended every 5 minutes).
 * Authenticated with Matchboard's existing cron-secret mechanism, matching
 * `/api/cron/notification-outbox` exactly. Deliberately `/api/cron/ai`, not the bundle's literal
 * `/api/internal/cron/ai` — this repo's own convention for cron endpoints is `/api/cron/*`
 * (`/api/cron/notification-outbox`, `/api/cron/live-reporting-reconciliation`); adapted per the
 * bundle's own change-control rule ("preserve the architecture and product contract and adapt
 * only the local placement... document any such adaptation").
 *
 * Runs the pipeline's "1. enqueues due match preparation jobs; 2. enqueues previous-week team
 * reviews; 3. claims eligible jobs atomically" worker-run sequence (07_EXECUTION_PIPELINE.md),
 * plus a fourth step this route also owns: retrying any `DELETE_PENDING` provider connections
 * left over from a transient matchboard-security delete failure (04_ORG_CONNECTION_FLOW.md
 * "Disconnect" step 5 / "Replace API key" step 8).
 */
export async function GET(request: Request) {
  const CRON_SECRET = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each of the four steps below runs in its own try/catch: a failure discovering *new* work
  // (match_prep scan, weekly_team_review scan, connection-deletion retries) must never prevent
  // `processAiJobsBatch()` from claiming and executing work that is *already* queued — the same
  // "one job's failure never blocks or corrupts another's" isolation `runner.ts`'s own per-job
  // loop already guarantees, now applied one level up. Before this, all four steps shared a
  // single try/catch: any one step throwing (even a scan step touching zero already-queued
  // jobs) meant `processAiJobsBatch()` was *never even called* for that entire invocation —
  // discovered in production because it meant no `AiAdvisorJob` had ever been claimed or
  // processed at all, not just the specific job whose domain trigger prompted the investigation
  // (ADR-0148 History).
  const matchPrepScan = await runCronStep("match_prep scan", enqueueDueMatchPrepJobs, { scanned: 0 });
  const weeklyTeamReviewScan = await runCronStep("weekly_team_review scan", enqueueDueWeeklyTeamReviewJobs, { scanned: 0 });
  const connectionDeletionRetryScan = await runCronStep("connection-deletion retry scan", retryPendingConnectionDeletions, { scanned: 0 });

  try {
    const result = await processAiJobsBatch();
    return NextResponse.json({
      ok: true,
      matchPrepScanned: matchPrepScan.value.scanned,
      matchPrepScanError: matchPrepScan.error,
      weeklyTeamReviewScanned: weeklyTeamReviewScan.value.scanned,
      weeklyTeamReviewScanError: weeklyTeamReviewScan.error,
      connectionDeletionRetriesScanned: connectionDeletionRetryScan.value.scanned,
      connectionDeletionRetryScanError: connectionDeletionRetryScan.error,
      ...result,
    });
  } catch (err) {
    logger.error({ err }, "[cron:ai] Error processing AI job batch");
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Runs one discovery step, isolating its failure from every other step (see the doc comment
 * above `GET`). Returns the step's own result on success, or `fallback` plus a `true` error flag
 * on failure — the caller reports both in the response body so a scan failure is visible to
 * whoever inspects cron output, without ever preventing `processAiJobsBatch()` from running.
 */
async function runCronStep<T extends { scanned: number }>(
  stepName: string,
  step: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; error: boolean }> {
  try {
    return { value: await step(), error: false };
  } catch (err) {
    logger.error({ err, step: stepName }, "[cron:ai] Error running discovery step, continuing to remaining steps");
    return { value: fallback, error: true };
  }
}

