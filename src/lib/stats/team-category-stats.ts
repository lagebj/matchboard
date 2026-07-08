import { db } from '@/lib/db';
import { type MatchCategory, type EntityMatchStats } from './match-category';
import { MatchStatus, MatchReportStatus } from '@/generated/prisma/client';

export async function getLeagueTeamStats(
  teamId: string,
  leagueSeasonId?: string,
): Promise<EntityMatchStats> {
  const matchWhere: any = {
    teamId,
    category: 'LEAGUE',
    status: { not: MatchStatus.CANCELLED },
    ...(leagueSeasonId ? { matchRound: { leagueSeasonId } } : {}),
  };

  const matches = await db.match.findMany({
    where: matchWhere,
    select: { id: true, homeAway: true },
  });

  const matchIds = matches.map((m) => m.id);

  const reports = await db.postMatchReport.findMany({
    where: {
      matchId: { in: matchIds },
      status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] },
    },
    select: {
      matchId: true,
      homeGoals: true,
      awayGoals: true,
    },
  });

  const matchHomeAway = new Map(matches.map((m) => [m.id, m.homeAway]));

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const report of reports) {
    if (report.homeGoals === null || report.awayGoals === null) continue;

    const homeAway = matchHomeAway.get(report.matchId);
    const isHome = homeAway === 'HOME';
    const teamGoals = isHome ? report.homeGoals : report.awayGoals;
    const oppGoals = isHome ? report.awayGoals : report.homeGoals;

    goalsFor += teamGoals;
    goalsAgainst += oppGoals;

    if (teamGoals > oppGoals) won++;
    else if (teamGoals === oppGoals) drawn++;
    else lost++;
  }

  const playerGoals = await db.goal.count({
    where: {
      report: { matchId: { in: matchIds }, status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] } },
    },
  });

  const playerAssists = await db.assist.count({
    where: {
      report: { matchId: { in: matchIds }, status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] } },
    },
  });

  return {
    entityType: 'LEAGUE_TEAM',
    entityId: teamId,
    category: 'LEAGUE',
    played: reports.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    playerGoals,
    playerAssists,
  };
}

export async function getEventSquadStats(
  eventSquadId: string,
  category: 'CUP' | 'OTHER',
): Promise<EntityMatchStats> {
  const matchWhere = {
    eventSquadId,
    category: category as MatchCategory,
    status: { not: MatchStatus.CANCELLED },
  };

  const matches = await db.eventMatch.findMany({
    where: matchWhere,
    select: { id: true },
  });

  const matchIds = matches.map((m) => m.id);

  const reports = await db.eventPostMatchReport.findMany({
    where: {
      eventMatchId: { in: matchIds },
      status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] },
    },
    select: {
      eventMatchId: true,
      ourScore: true,
      opponentScore: true,
    },
  });

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const report of reports) {
    if (report.ourScore === null || report.opponentScore === null) continue;

    goalsFor += report.ourScore;
    goalsAgainst += report.opponentScore;

    if (report.ourScore > report.opponentScore) won++;
    else if (report.ourScore === report.opponentScore) drawn++;
    else lost++;
  }

  const playerGoals = await db.eventGoalEvent.count({
    where: {
      report: {
        eventMatchId: { in: matchIds },
        status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] },
      },
    },
  });

  const playerAssists = await db.eventAssistEvent.count({
    where: {
      report: {
        eventMatchId: { in: matchIds },
        status: { in: [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED] },
      },
    },
  });

  return {
    entityType: 'EVENT_SQUAD',
    entityId: eventSquadId,
    category,
    played: reports.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    playerGoals,
    playerAssists,
  };
}