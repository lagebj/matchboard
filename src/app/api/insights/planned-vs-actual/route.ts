import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlannedVsActualDeltas } from "@/lib/insights/planned-vs-actual-delta";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
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

  const deltas = await getPlannedVsActualDeltas({
    leagueSeasonId,
    scope: (searchParams.get("scope") ?? "full_year") as InsightScope,
    context: (searchParams.get("context") ?? "league") as InsightContext,
  });

  return NextResponse.json({ deltas });
}