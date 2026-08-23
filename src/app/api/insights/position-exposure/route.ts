import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPositionExposure } from "@/lib/insights/position-exposure";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireActorContext();
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

  const rows = await getPositionExposure({
    leagueSeasonId,
    scope: (searchParams.get("scope") ?? "full_year") as InsightScope,
    context: (searchParams.get("context") ?? "league") as InsightContext,
    includeInactive: searchParams.get("includeInactive") === "true",
  });

  return NextResponse.json({ rows });
}
