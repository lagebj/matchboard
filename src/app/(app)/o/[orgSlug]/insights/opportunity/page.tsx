import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { OpportunityMatrixClient } from "@/app/(app)/insights/opportunity/opportunity-matrix-client";

export const dynamic = "force-dynamic";

export default async function OpportunityMatrixPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  const orgWhere = ctx.orgFilter.filter;

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  const teams = await db.team.findMany({
    where: { ...orgWhere },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <OpportunityMatrixClient
      leagueSeasons={leagueSeasons.map((ls) => ({
        id: ls.id,
        name: ls.name,
        startDate: ls.startDate.toISOString(),
        endDate: ls.endDate.toISOString(),
      }))}
      activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
      teams={teams}
    />
  );
}