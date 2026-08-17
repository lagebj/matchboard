import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlayerPathways } from "@/lib/pathways/get-player-pathways";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";
import type { PathwayViewMode } from "@/lib/pathways/pathways-types";

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
  const scope = searchParams.get("scope") ?? "full_year";
  const context = searchParams.get("context") ?? "league";
  const teamId = searchParams.get("teamId") ?? undefined;
  const matchRoundId = searchParams.get("matchRoundId") ?? undefined;
  const includeRemoved = searchParams.get("includeRemoved") === "true";
  const includeInactive = searchParams.get("includeInactive") === "true";
  const viewModeParam = searchParams.get("viewMode") ?? "finalized_only";

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

  const viewMode: PathwayViewMode =
    viewModeParam === "include_drafts" ? "include_drafts" : "finalized_only";

  const pathways = await getPlayerPathways(
    {
      leagueSeasonId,
      scope: scope as InsightScope,
      context: context as InsightContext,
      teamId,
      matchRoundId,
      includeRemoved,
      includeInactive,
    },
    viewMode,
  );

  return NextResponse.json({ pathways });
}