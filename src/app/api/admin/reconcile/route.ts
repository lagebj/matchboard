import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileCanonicalDerivedData } from "@/lib/data-integrity/reconcile-canonical-derived-data";
import { reconcileSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("admin-reconcile", 2, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many reconciliation requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reconcileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { dryRun, leagueSeasonId, matchId, domains } = parsed.data;

  try {
    const result = await reconcileCanonicalDerivedData({
      dryRun,
      leagueSeasonId,
      matchId,
      domains,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}