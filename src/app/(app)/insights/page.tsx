import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { InsightsOverviewClient } from "./insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const ctx = await requireActorContext();
  const orgWhere = ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  return (
    <InsightsOverviewClient
      leagueSeasons={leagueSeasons.map((ls) => ({
        id: ls.id,
        name: ls.name,
        startDate: ls.startDate.toISOString(),
        endDate: ls.endDate.toISOString(),
      }))}
      activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
    />
  );
}