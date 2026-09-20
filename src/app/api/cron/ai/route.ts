import { NextResponse } from "next/server";
import "@/lib/ai/register-capabilities";
import { processAiJobsBatch } from "@/lib/ai/jobs/runner";
import { enqueueDueMatchPrepJobs } from "@/lib/ai/jobs/scheduled-triggers";
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
 * Runs the pipeline's "1. enqueues due match preparation jobs ... 3. claims eligible jobs
 * atomically" worker-run sequence (07_EXECUTION_PIPELINE.md). Step 2, "enqueues previous-week
 * team reviews" (`weekly_team_review`), lands in a later PR alongside that capability's own
 * context builder.
 */
export async function GET(request: Request) {
  const CRON_SECRET = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchPrepScan = await enqueueDueMatchPrepJobs();
    const result = await processAiJobsBatch();

    return NextResponse.json({
      ok: true,
      matchPrepScanned: matchPrepScan.scanned,
      ...result,
    });
  } catch (err) {
    logger.error({ err }, "[cron:ai] Error processing AI job batch");
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

