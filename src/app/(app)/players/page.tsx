import { db } from "@/lib/db";
import { getPlayersSeasonOverview, getPlayersCurrentRoundAttention } from "@/lib/players/get-players-overview";
import type { PlayerSeasonOverviewRow } from "@/lib/players/get-players-overview";
import { PlayersPageClient } from "@/components/players/players-page-client";

type PlayersPageProps = {
  searchParams: Promise<{
    mode?: string;
    periodId?: string;
    roundId?: string;
    error?: string;
    saved?: string;
  }>;
};

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const { mode, periodId, roundId, error, saved } = await searchParams;

  const [players, teams, planningPeriods, matchRounds] = await Promise.all([
    db.player.findMany({
      where: { removedAt: null, active: true },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    db.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.planningPeriod.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    db.matchRound.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, planningPeriodId: true },
    }),
  ]);

  const selectedPeriodId = periodId ?? planningPeriods[0]?.id ?? "";

  const seasonData = selectedPeriodId
    ? await getPlayersSeasonOverview(selectedPeriodId)
    : { planningPeriod: { id: "", label: "No planning period" }, seasonRows: [] as PlayerSeasonOverviewRow[] };

  const selectedRoundId = roundId ?? (matchRounds.length > 0 ? matchRounds[0].id : undefined);

  const currentRoundRows = selectedRoundId
    ? await getPlayersCurrentRoundAttention(selectedRoundId)
    : [];

  const matchIds = selectedPeriodId
    ? await db.match.findMany({
        where: { matchRound: { planningPeriodId: selectedPeriodId } },
        select: { id: true },
      }).then((m) => m.map((x) => x.id))
    : [];

  const reportedMatchCount = matchIds.length > 0
    ? await db.postMatchReport.count({
        where: {
          status: { in: ["REPORTED", "LOCKED"] },
          matchId: { in: matchIds },
        },
      })
    : 0;

  const totalActualAppearances = seasonData.seasonRows.reduce((sum, r) => sum + r.actualAppearances, 0);
  const totalMatchdayAdditions = seasonData.seasonRows.reduce((sum, r) => sum + r.matchdayAdditions, 0);

  return (
    <PlayersPageClient
      players={players.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        coreTeamId: p.coreTeamId,
        coreTeam: p.coreTeam,
        primaryPosition: p.primaryPosition,
        currentAvailability: p.currentAvailability,
        nonRotatable: p.nonRotatable,
        reducedMatchLoadAllowed: p.reducedMatchLoadAllowed,
      }))}
      teams={teams}
      planningPeriods={planningPeriods}
      matchRounds={matchRounds}
      seasonRows={seasonData.seasonRows}
      currentRoundRows={currentRoundRows}
      selectedPeriodId={selectedPeriodId}
      selectedRoundId={selectedRoundId}
      initialMode={mode}
      reportedMatchCount={reportedMatchCount}
      totalActualAppearances={totalActualAppearances}
      totalMatchdayAdditions={totalMatchdayAdditions}
      error={error}
      saved={saved}
    />
  );
}