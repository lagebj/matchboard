import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMovementPathSummary } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const rl = rateLimit("season:movement-paths", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
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

  const paths = await getMovementPathSummary(leagueSeasonId, includeDrafts);
  return NextResponse.json(paths);
}