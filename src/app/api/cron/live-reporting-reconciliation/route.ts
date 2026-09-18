import { NextResponse } from "next/server";
import { reconcileExpiredLiveReportingSessions } from "@/lib/live-match/reconcile-expired-live-reporting-sessions";
import { getCronSecret } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * ADR-0146 §7 — mirrors `src/app/api/cron/notification-outbox/route.ts` exactly: `CRON_SECRET`
 * bearer-auth, no new authentication mechanism. This is an internal system path (bundle §04.14)
 * — never an unauthenticated public endpoint that lets arbitrary callers finish matches.
 */
export async function GET(request: Request) {
  const CRON_SECRET = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileExpiredLiveReportingSessions();

    return NextResponse.json({
      ok: true,
      finished: result.finished.length,
      failed: result.failed.length,
    });
  } catch (err) {
    logger.error({ err }, "[cron:live-reporting-reconciliation] Error reconciling expired Live Reporting sessions");
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
