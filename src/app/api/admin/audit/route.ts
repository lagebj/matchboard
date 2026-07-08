import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { auditDataIntegrity } from "@/lib/data-integrity/audit-data-integrity";

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
  const leagueSeasonId = url.searchParams.get("leagueSeasonId") ?? undefined;
  const matchId = url.searchParams.get("matchId") ?? undefined;

  try {
    const result = await auditDataIntegrity({ leagueSeasonId, matchId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}