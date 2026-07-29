import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { auditDataIntegrity } from "@/lib/data-integrity/audit-data-integrity";
import { auditQuerySchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";

export async function GET(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("admin-audit", 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many audit requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const parsed = auditQuerySchema.safeParse({
    leagueSeasonId: url.searchParams.get("leagueSeasonId") || undefined,
    matchId: url.searchParams.get("matchId") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { leagueSeasonId, matchId } = parsed.data;

  try {
    const result = await auditDataIntegrity({ leagueSeasonId, matchId });
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}