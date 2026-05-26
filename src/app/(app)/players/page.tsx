import { db } from "@/lib/db";
import { getPlayersSeasonOverview, getPlayersCurrentRoundAttention } from "@/lib/players/get-players-overview";
import type { PlayerSeasonOverviewRow, SeasonFairnessWarning, SeasonOverviewResult } from "@/lib/players/get-players-overview";
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
    : { planningPeriod: { id: "", label: "No planning period" }, roundColumns: [], seasonRows: [] as PlayerSeasonOverviewRow[], movementPaths: [] as SeasonOverviewResult["movementPaths"], fairnessWarnings: [] as SeasonFairnessWarning[] };

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

  const roundCounts = selectedPeriodId
    ? await db.matchRound.groupBy({
        by: ["status"],
        where: { planningPeriodId: selectedPeriodId },
        _count: { status: true },
      }).then((groups) => {
          const counts = { total: 0, finalised: 0, draft: 0 };
          for (const g of groups) {
            counts.total += g._count.status;
            if (g.status === "FINALIZED") counts.finalised += g._count.status;
            if (g.status === "DRAFT" || g.status === "BLOCKED" || g.status === "READY") counts.draft += g._count.status;
          }
          return counts;
        })
    : { total: 0, finalised: 0, draft: 0 };

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
      roundColumns={seasonData.roundColumns}
      movementPaths={seasonData.movementPaths}
      fairnessWarnings={seasonData.fairnessWarnings}
      currentRoundRows={currentRoundRows}
      selectedPeriodId={selectedPeriodId}
      selectedRoundId={selectedRoundId}
      initialMode={mode}
      reportedMatchCount={reportedMatchCount}
      totalActualAppearances={totalActualAppearances}
      totalMatchdayAdditions={totalMatchdayAdditions}
      totalRounds={roundCounts.total}
      finalisedRounds={roundCounts.finalised}
      draftRounds={roundCounts.draft}
      error={error}
      saved={saved}
    />
  );
}