import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/email/outbox";
import { getCronSecret } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const CRON_SECRET = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOutboxBatch();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    logger.error({ err }, "[cron:notification-outbox] Error processing outbox batch");
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}