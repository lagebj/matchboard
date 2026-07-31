import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerHistory } from "@/lib/audit/player-history";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const { playerId } = await params;
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
  if (orgFilter.type === "org" && leagueSeason.organisationId !== orgFilter.organisationId) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  const data = await getPlayerHistory(playerId, leagueSeasonId);

  if (!data) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}