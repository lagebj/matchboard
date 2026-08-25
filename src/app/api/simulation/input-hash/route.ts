import { NextRequest, NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { computeSimulationInputHash } from "@/lib/simulation/apply-simulation";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: "leagueSeasonId is required" }, { status: 400 });
  }

  const owned = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  try {
    const hash = await computeSimulationInputHash(leagueSeasonId);
    return NextResponse.json(hash);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}