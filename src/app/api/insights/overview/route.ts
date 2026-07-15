import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getInsightOverview } from "@/lib/insights/insights-overview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId is required" },
      { status: 400 },
    );
  }

  const overview = await getInsightOverview(leagueSeasonId);
  return NextResponse.json(overview);
}