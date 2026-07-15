import { db } from "@/lib/db";
import { LoadTimelineClient } from "./load-timeline-client";

export const dynamic = "force-dynamic";

export default async function LoadTimelinePage() {
  const leagueSeasons = await db.leagueSeason.findMany({
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