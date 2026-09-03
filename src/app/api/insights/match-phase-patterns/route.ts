import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getTeamSeasonMatchPhasePatterns } from "@/lib/evidence/match-phase-pattern-evidence";

export const runtime = "nodejs";

/**
 * GET /api/insights/match-phase-patterns?leagueSeasonId=&teamId=
 *
 * Evidence-Informed Match Planning programme, Bundle 3 (long-term observability). Reuses
 * `getTeamSeasonMatchPhasePatterns()` (Bundle 2) directly — this route has no domain logic of
 * its own beyond auth/scope validation, matching the same thin-route pattern every other
 * `/api/insights/*` route uses.
 */
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
  const teamId = searchParams.get("teamId");

  if (!leagueSeasonId || !teamId) {
    return NextResponse.json({ error: "leagueSeasonId and teamId are required" }, { status: 400 });
  }

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { organisationId: true },
  });
  if (!leagueSeason || leagueSeason.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  const team = await db.team.findFirst({
    where: { id: teamId },
    select: { organisationId: true },
  });
  if (!team || team.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "Team not found or access denied." }, { status: 404 });
  }

  const patterns = await getTeamSeasonMatchPhasePatterns(leagueSeasonId, teamId, ctx.orgFilter);

  return NextResponse.json({ patterns });
}
