import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { LoadTimelineClient } from "@/app/(app)/insights/load/load-timeline-client";

export const dynamic = "force-dynamic";

export default async function LoadTimelinePage({ params }: { params: Promise<{ orgSlug: string }> }) {
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
    <LoadTimelineClient
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