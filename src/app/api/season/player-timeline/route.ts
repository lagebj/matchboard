import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlayerMovementTimeline } from "@/lib/selection/get-season-overview";
import { requireActorContext } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ctx = await requireActorContext();
  const rl = rateLimit("season:player-timeline", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const { searchParams } = request.nextUrl;
  const playerId = searchParams.get("playerId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";
  const leagueSeasonId = searchParams.get("leagueSeasonId") || undefined;

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  if (leagueSeasonId) {
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
  }

  const timeline = await getPlayerMovementTimeline(playerId, includeDrafts, leagueSeasonId);
  return NextResponse.json(timeline);
}