import { NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getAuditWorkItems } from "@/lib/audit/planned-vs-actual";

export async function GET(request: Request) {
  const ctx = await requireActorContext();

  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get("leagueSeasonId");

  if (!leagueSeasonId) {
    return NextResponse.json(
      { error: "leagueSeasonId query parameter is required" },
      { status: 400 },
    );
  }

  const data = await getAuditWorkItems(leagueSeasonId, ctx.orgFilter);
  return NextResponse.json(data);
}