import { db } from "@/lib/db";
import { formatPlanningPeriodRange } from "@/lib/date/format-planning-period-range";

export type TeamPeriodResultsRow = {
  teamId: string;
  teamName: string;
  corePlayerCount: number;
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
  planningPeriod: {
    id: string;
    startDate: Date;
    endDate: Date;
    displayLabel: string;
  };
  rows: TeamPeriodResultsRow[];
};

export async function getTeamsResultsOverview(
  planningPeriodId: string,
): Promise<TeamsResultsOverview> {
  const planningPeriod = await db.planningPeriod.findUniqueOrThrow({
    where: { id: planningPeriodId },
    select: { id: true, startDate: true, endDate: true },
  });

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      corePlayers: {
        where: { removedAt: null },
        select: { id: true },
      },
    },
    orderBy: [{ supportPriority: "asc" }, { name: "asc" }],
  });

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) {
    return {
      planningPeriod: {
        id: planningPeriod.id,
        startDate: planningPeriod.startDate,
        endDate: planningPeriod.endDate,
        displayLabel: formatPlanningPeriodRange(
          new Date(planningPeriod.startDate),
          new Date(planningPeriod.endDate),
        ),
      },
      rows: [],
    };
  }

  const matches = await db.match.findMany({
    where: {
      teamId: { in: teamIds },
      matchRound: { planningPeriodId },
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

    return {
      teamId: team.id,
      teamName: team.name,
      corePlayerCount: team.corePlayers.length,
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
    planningPeriod: {
      id: planningPeriod.id,
      startDate: planningPeriod.startDate,
      endDate: planningPeriod.endDate,
      displayLabel: formatPlanningPeriodRange(
        new Date(planningPeriod.startDate),
        new Date(planningPeriod.endDate),
      ),
    },
    rows,
  };
}