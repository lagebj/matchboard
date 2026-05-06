import { NextRequest, NextResponse } from "next/server";
import { getPlayerMovementTimeline } from "@/lib/selection/get-season-overview";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const playerId = searchParams.get("playerId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const timeline = await getPlayerMovementTimeline(playerId, includeDrafts);
  return NextResponse.json(timeline);
}