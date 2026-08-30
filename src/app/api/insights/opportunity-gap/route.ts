import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getOpportunityGap } from "@/lib/insights/opportunity-gap";
import type { InsightScope, InsightContext } from "@/lib/insights/insights-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveSituationContext } from "@/lib/situational/resolve-situation-context";
import { projectCandidates } from "@/lib/situational/get-coach-situation-projection";
import { opportunityGapRowsToCandidates } from "@/lib/situational/providers/opportunity-gap-candidate-provider";

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

  const rows = await getOpportunityGap({
    leagueSeasonId,
    scope: (searchParams.get("scope") ?? "full_year") as InsightScope,
    context: (searchParams.get("context") ?? "league") as InsightContext,
    includeInactive: searchParams.get("includeInactive") === "true",
  });

  // Situational decision support (ADR-0107, Phase 7): this Insights page is a deliberately
  // analytical route, so it resolves LONG_TERM — reusing the rows already loaded above rather
  // than issuing a second query for the same data.
  const situationContext = resolveSituationContext({
    nowIso: new Date().toISOString(),
    matches: [],
    routeIntent: "INSIGHTS",
  });
  const candidates = opportunityGapRowsToCandidates(rows);
  const projection = await projectCandidates(situationContext, candidates);

  return NextResponse.json({ rows, projection });
}
