import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getConflictReview } from "@/lib/insights/conflict-review";
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

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId is required" },
      { status: 400 },
    );
  }

  const conflicts = await getConflictReview({
    leagueSeasonId,
    scope: (searchParams.get("scope") ?? "full_year") as InsightScope,
    context: (searchParams.get("context") ?? "league") as InsightContext,
  });

  return NextResponse.json({ conflicts });
}