import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/email/outbox";
import { getCronSecret } from "@/lib/env";

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
    console.error("[cron:notification-outbox] Error processing outbox batch:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}