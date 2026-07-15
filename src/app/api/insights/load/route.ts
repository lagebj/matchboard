import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getLoadTimeline } from "@/lib/insights/load-timeline";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const scope = searchParams.get("scope") ?? "full_year";
  const context = searchParams.get("context") ?? "league";
  const teamId = searchParams.get("teamId") ?? undefined;
  const matchRoundId = searchParams.get("matchRoundId") ?? undefined;
  const includeRemoved = searchParams.get("includeRemoved") === "true";
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId is required" },
      { status: 400 },
    );
  }

  const timeline = await getLoadTimeline({
    leagueSeasonId,
    scope: scope as InsightScope,
    context: context as InsightContext,
    teamId,
    matchRoundId,
    includeRemoved,
    includeInactive,
  });

  return NextResponse.json({ timeline });
}