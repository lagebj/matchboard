import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/date/format-date-range";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";

export type TeamPeriodResultsRow = {
  teamId: string;
  teamName: string;
  corePlayerCount: number;
  overallRatingValue: number | null;
  overallRatingDisplay: string;
  ratedPlayerCount: number;
  totalPlayerCount: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
};

export type TeamsResultsOverview = {
  leagueSeason: {
    id: string;
    startDate: Date;
    endDate: Date;
    displayLabel: string;
  };
  rows: TeamPeriodResultsRow[];
};

export async function getTeamsResultsOverview(
  leagueSeasonId: string,
): Promise<TeamsResultsOverview> {
  const leagueSeason = await db.leagueSeason.findUniqueOrThrow({
    where: { id: leagueSeasonId },
    select: { id: true, startDate: true, endDate: true },
  });

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      corePlayers: {
        where: { removedAt: null, active: true },
        select: {
          id: true,
          ballControl: true,
          passing: true,
          firstTouch: true,
          oneVOneAttacking: true,
          positioning: true,
          oneVOneDefending: true,
          decisionMaking: true,
          effort: true,
          teamplay: true,
          concentration: true,
          speed: true,
          strength: true,
        },
      },
    },
    orderBy: [{ supportPriority: "asc" }, { name: "asc" }],
  });

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) {
    return {
      leagueSeason: {
        id: leagueSeason.id,
        startDate: leagueSeason.startDate,
        endDate: leagueSeason.endDate,
        displayLabel: formatDateRange(
          new Date(leagueSeason.startDate),
          new Date(leagueSeason.endDate),
        ),
      },
      rows: [],
    };
  }

  const matches = await db.match.findMany({
    where: {
      teamId: { in: teamIds },
      matchRound: { leagueSeasonId },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      teamId: true,
      homeAway: true,
    },
  });

  const matchIds = matches.map((m) => m.id);

  const completedReports = matchIds.length > 0
    ? await db.postMatchReport.findMany({
        where: {
          matchId: { in: matchIds },
          status: { in: ["REPORTED", "LOCKED"] },
        },
        select: {
          matchId: true,
          homeGoals: true,
          awayGoals: true,
        },
      })
    : [];

  const reportByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
  for (const r of completedReports) {
    if (r.homeGoals !== null && r.awayGoals !== null) {
      reportByMatchId.set(r.matchId, { homeGoals: r.homeGoals, awayGoals: r.awayGoals });
    }
  }

  const rows: TeamPeriodResultsRow[] = teams.map((team) => {
    const teamMatches = matches.filter((m) => m.teamId === team.id);
    let matchesPlayed = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;

    for (const match of teamMatches) {
      const report = reportByMatchId.get(match.id);
      if (!report) continue;

      const isHome = match.homeAway === "HOME";
      const ownGoals = isHome ? report.homeGoals : report.awayGoals;
      const oppGoals = isHome ? report.awayGoals : report.homeGoals;

      matchesPlayed++;
      goalsFor += ownGoals;
      goalsAgainst += oppGoals;

      if (ownGoals > oppGoals) wins++;
      else if (ownGoals === oppGoals) draws++;
      else losses++;

      if (oppGoals === 0) cleanSheets++;
    }

    const playerRatings = team.corePlayers.map((p) =>
      getPlayerOverallRating({
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
      }),
    );
    const ratedValues = playerRatings.map((r) => r.value).filter((v): v is number => v !== null);
    const teamOverallRating = ratedValues.length > 0
      ? Math.round((ratedValues.reduce((sum, v) => sum + v, 0) / ratedValues.length) * 10) / 10
      : null;

    return {
      teamId: team.id,
      teamName: team.name,
      corePlayerCount: team.corePlayers.length,
      overallRatingValue: teamOverallRating,
      overallRatingDisplay: teamOverallRating !== null ? teamOverallRating.toFixed(1) : "Not rated",
      ratedPlayerCount: ratedValues.length,
      totalPlayerCount: team.corePlayers.length,
      matchesPlayed,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      cleanSheets,
    };
  });

  return {
    leagueSeason: {
      id: leagueSeason.id,
      startDate: leagueSeason.startDate,
      endDate: leagueSeason.endDate,
      displayLabel: formatDateRange(
        new Date(leagueSeason.startDate),
        new Date(leagueSeason.endDate),
      ),
    },
    rows,
  };
}