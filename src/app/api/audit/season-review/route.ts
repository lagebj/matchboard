import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getSeasonReview } from "@/lib/audit/planned-vs-actual";

export async function GET(request: Request) {
  await requireCoachAccess();

  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const data = await getSeasonReview(leagueSeasonId);
  return NextResponse.json(data);
}