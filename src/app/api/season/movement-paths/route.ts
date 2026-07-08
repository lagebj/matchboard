import { NextRequest, NextResponse } from "next/server";
import { getMovementPathSummary } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
  }

  const paths = await getMovementPathSummary(leagueSeasonId, includeDrafts);
  return NextResponse.json(paths);
}