import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { MatchPhasePatternsClient } from "@/app/(app)/insights/match-phase-patterns/match-phase-patterns-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

export default async function MatchPhasePatternsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const teams = await db.team.findMany({
    where: { ...orgWhere, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <MatchPhasePatternsClient
      leagueSeasons={leagueSeasons.map((ls) => ({
        id: ls.id,
        name: ls.name,
        startDate: ls.startDate.toISOString(),
        endDate: ls.endDate.toISOString(),
      }))}
      activeLeagueSeasonId={leagueSeasons[0]?.id ?? null}
      teams={teams}
      activeTeamId={teams[0]?.id ?? null}
    />
  );
}
