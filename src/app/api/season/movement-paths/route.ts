import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMovementPathSummary } from "@/lib/selection/get-season-overview";
import { requireActorContext } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ctx = await requireActorContext();
  const rl = await rateLimit("season:movement-paths", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
  }

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { organisationId: true },
  });
  if (!leagueSeason) {
    return NextResponse.json({ error: "League season not found" }, { status: 404 });
  }
  if (leagueSeason.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  const paths = await getMovementPathSummary(leagueSeasonId, includeDrafts);
  return NextResponse.json(paths);
}