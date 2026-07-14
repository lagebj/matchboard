import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getPlayersSeasonOverview, getPlayersCurrentRoundAttention } from "@/lib/players/get-players-overview";
import type { PlayerSeasonOverviewRow } from "@/lib/players/get-players-overview";
import { PlayersPageClient } from "@/components/players/players-page-client";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import type { RatingSummary } from "@/lib/ratings/player-rating";

type PlayersPageProps = {
  searchParams: Promise<{
    mode?: string;
    periodId?: string;
    roundId?: string;
    showRemoved?: string;
    error?: string;
    saved?: string;
  }>;
};

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const { mode, periodId, roundId, showRemoved, error, saved } = await searchParams;
  const includeRemoved = showRemoved === "1";

  const playerFilter = includeRemoved
    ? { removedAt: { not: null } satisfies Prisma.DateTimeNullableFilter<"Player"> }
    : { removedAt: null, active: true };

  const [players, removedPlayerCount, teams, leagueSeasons, matchRounds] = await Promise.all([
    db.player.findMany({
      where: playerFilter,
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    db.player.count({ where: { removedAt: { not: null } } }),
    db.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.leagueSeason.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    db.matchRound.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, leagueSeasonId: true },
    }),
  ]);

  const selectedPeriodId = periodId ?? leagueSeasons[0]?.id ?? "";

  const seasonData = selectedPeriodId
    ? await getPlayersSeasonOverview(selectedPeriodId)
    : { leagueSeason: { id: "", label: "No phase" }, seasonRows: [] as PlayerSeasonOverviewRow[] };

  const selectedRoundId = roundId ?? (matchRounds.length > 0 ? matchRounds[0].id : undefined);

  const currentRoundRows = selectedRoundId
    ? await getPlayersCurrentRoundAttention(selectedRoundId)
    : [];

  const playerRatings = new Map<string, RatingSummary>();
  for (const p of players) {
    playerRatings.set(p.id, getPlayerOverallRating({
      ballControl: p.ballControl,
      passing: p.passing,
      firstTouch: p.firstTouch,
      oneVOneAttacking: p.oneVOneAttacking,
      positioning: p.positioning,
      oneVOneDefending: p.oneVOneDefending,
      decisionMaking: p.decisionMaking,
      effort: p.effort,
      teamplay: p.teamplay,
      concentration: p.concentration,
      speed: p.speed,
      strength: p.strength,
    }));
  }

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
        overallRating: playerRatings.get(p.id)!,
        removed: p.removedAt !== null,
      }))}
      teams={teams}
      leagueSeasons={leagueSeasons}
      matchRounds={matchRounds}
      seasonRows={seasonData.seasonRows}
      currentRoundRows={currentRoundRows}
      selectedPeriodId={selectedPeriodId}
      selectedRoundId={selectedRoundId}
      includeRemoved={includeRemoved}
      removedPlayerCount={removedPlayerCount}
      initialMode={mode}
      error={error}
      saved={saved}
    />
  );
}