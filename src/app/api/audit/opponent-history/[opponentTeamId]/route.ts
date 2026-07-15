import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getOpponentHistory } from "@/lib/audit/opponent-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ opponentTeamId: string }> },
) {
  await requireCoachAccess();

  const { opponentTeamId } = await params;
  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const data = await getOpponentHistory(opponentTeamId, leagueSeasonId);

  if (!data) {
    return NextResponse.json({ error: "Opponent team not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}