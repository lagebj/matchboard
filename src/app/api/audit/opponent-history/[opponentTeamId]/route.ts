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
  const footballGroupId = searchParams.get("footballGroupId");
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  let resolvedGroupId = footballGroupId;

  if (!resolvedGroupId && leagueSeasonId) {
    const leagueSeason = await db.leagueSeason.findFirst({
      where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
      select: { organisationId: true, footballGroupId: true },
    });
    if (!leagueSeason) {
      return NextResponse.json({ error: "League season not found" }, { status: 404 });
    }
    if (leagueSeason.organisationId !== ctx.organisationId) {
      return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
    }
    resolvedGroupId = leagueSeason.footballGroupId;
  }

  if (!resolvedGroupId) {
    return NextResponse.json(
      { error: "footballGroupId or leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const data = await getOpponentHistory(opponentTeamId, resolvedGroupId, ctx.orgFilter);

  if (!data) {
    return NextResponse.json({ error: "Opponent team not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}