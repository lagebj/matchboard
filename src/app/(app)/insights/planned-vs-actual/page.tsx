import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { PlannedVsActualClient } from "./planned-vs-actual-client";

export const dynamic = "force-dynamic";

export default async function PlannedVsActualPage() {
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
    },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  const teams = await db.team.findMany({
    where: { ...orgWhere },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PlannedVsActualClient
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