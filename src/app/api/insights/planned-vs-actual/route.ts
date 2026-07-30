import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getPlannedVsActualDeltas } from "@/lib/insights/planned-vs-actual-delta";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let coach;
  try {
    coach = await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId is required" },
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

  const deltas = await getPlannedVsActualDeltas({
    leagueSeasonId,
    scope: (searchParams.get("scope") ?? "full_year") as InsightScope,
    context: (searchParams.get("context") ?? "league") as InsightContext,
  });

  return NextResponse.json({ deltas });
}