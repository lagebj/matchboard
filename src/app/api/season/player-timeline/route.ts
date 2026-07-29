import { NextRequest, NextResponse } from "next/server";
import { getPlayerMovementTimeline } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
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

  const timeline = await getPlayerMovementTimeline(playerId, includeDrafts, leagueSeasonId);
  return NextResponse.json(timeline);
}