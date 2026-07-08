import { NextRequest, NextResponse } from "next/server";
import { getSeasonPlayerRoundMatrix } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
  }

  const matrix = await getSeasonPlayerRoundMatrix(leagueSeasonId, includeDrafts);
  return NextResponse.json(matrix);
}