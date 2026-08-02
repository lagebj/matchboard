import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getOpponentHistory } from "@/lib/audit/opponent-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ opponentTeamId: string }> },
) {
  const ctx = await requireActorContext();

  const { opponentTeamId } = await params;
  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    select: { organisationId: true },
  });
  if (!leagueSeason) {
    return NextResponse.json({ error: "League season not found" }, { status: 404 });
  }
  if (leagueSeason.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  const data = await getOpponentHistory(opponentTeamId, leagueSeasonId);

  if (!data) {
    return NextResponse.json({ error: "Opponent team not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}