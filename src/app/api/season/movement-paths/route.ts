import { NextRequest, NextResponse } from "next/server";
import { getMovementPathSummary } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const rl = rateLimit("season:movement-paths", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
  }

  const paths = await getMovementPathSummary(leagueSeasonId, includeDrafts);
  return NextResponse.json(paths);
}