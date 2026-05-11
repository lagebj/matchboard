import { NextRequest, NextResponse } from "next/server";
import { getPlayerMovementTimeline } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const { searchParams } = request.nextUrl;
  const playerId = searchParams.get("playerId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";
  const planningPeriodId = searchParams.get("planningPeriodId") || undefined;

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const timeline = await getPlayerMovementTimeline(playerId, includeDrafts, planningPeriodId);
  return NextResponse.json(timeline);
}