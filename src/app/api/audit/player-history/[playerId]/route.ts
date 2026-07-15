import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getPlayerHistory } from "@/lib/audit/player-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  await requireCoachAccess();

  const { playerId } = await params;
  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const data = await getPlayerHistory(playerId, leagueSeasonId);

  if (!data) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}