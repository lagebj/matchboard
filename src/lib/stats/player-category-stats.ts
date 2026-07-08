import { db } from '@/lib/db';
import { type MatchCategory, type CategoryStatLine, type PlayerCategoryStats, sumCategoryStatLines } from './match-category';
import { MatchStatus, MatchReportStatus } from '@/generated/prisma/client';

export async function getPlayerCategoryStats(
  playerId: string,
  leagueSeasonId?: string,
): Promise<PlayerCategoryStats> {
  const league = await getLeagueStatsForPlayer(playerId, leagueSeasonId);
  const cup = await getCupStatsForPlayer(playerId);
  const other = await getOtherStatsForPlayer(playerId);
  const total = sumCategoryStatLines(league, cup, other);

  return {
    playerId,
    league,
    cup,
    other,
    total,
  };
}

async function getLeagueStatsForPlayer(
  playerId: string,
  leagueSeasonId?: string,
): Promise<CategoryStatLine> {
  const completedStatuses = [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED];

  const matchWhere: any = {
    category: 'LEAGUE',
    status: { not: MatchStatus.CANCELLED },
    ...(leagueSeasonId ? { matchRound: { leagueSeasonId } } : {}),
  };

  const leagueMatches = await db.match.findMany({
    where: matchWhere,
    select: { id: true },
  });
  const leagueMatchIds = leagueMatches.map((m) => m.id);

  const completedReportMatchIds = await db.postMatchReport.findMany({
    where: { matchId: { in: leagueMatchIds }, status: { in: completedStatuses } },
    select: { matchId: true },
  }).then((r) => r.map((x) => x.matchId));

  const actuals = await db.postMatchPlayerActual.count({
    where: {
      playerId,
      attendanceStatus: 'PRESENT',
      matchId: { in: leagueMatchIds },
      report: { status: { in: completedStatuses } },
    },
  });

  const goals = await db.goal.count({
    where: {
      playerId,
      report: { status: { in: completedStatuses }, matchId: { in: completedReportMatchIds } },
    },
  });

  const assists = await db.assist.count({
    where: {
      playerId,
      report: { status: { in: completedStatuses }, matchId: { in: completedReportMatchIds } },
    },
  });

  return {
    category: 'LEAGUE',
    appearances: actuals,
    goals,
    assists,
  };
}

async function getCupStatsForPlayer(playerId: string): Promise<CategoryStatLine> {
  return getEventStatsForPlayer(playerId, 'CUP');
}

async function getOtherStatsForPlayer(playerId: string): Promise<CategoryStatLine> {
  return getEventStatsForPlayer(playerId, 'OTHER');
}

async function getEventStatsForPlayer(
  playerId: string,
  category: 'CUP' | 'OTHER',
): Promise<CategoryStatLine> {
  const completedStatuses = [MatchReportStatus.REPORTED, MatchReportStatus.LOCKED];

  const eventMatches = await db.eventMatch.findMany({
    where: { category, status: { not: MatchStatus.CANCELLED } },
    select: { id: true },
  });
  const eventMatchIds = eventMatches.map((m) => m.id);

  const completedReportMatchIds = await db.eventPostMatchReport.findMany({
    where: { eventMatchId: { in: eventMatchIds }, status: { in: completedStatuses } },
    select: { eventMatchId: true },
  }).then((r) => r.map((x) => x.eventMatchId));

  const actuals = await db.eventPostMatchPlayer.count({
    where: {
      playerId,
      attendanceStatus: 'PRESENT',
      report: {
        eventMatchId: { in: eventMatchIds },
        status: { in: completedStatuses },
      },
    },
  });

  const goals = await db.eventGoalEvent.count({
    where: {
      playerId,
      report: {
        eventMatchId: { in: completedReportMatchIds },
        status: { in: completedStatuses },
      },
    },
  });

  const assists = await db.eventAssistEvent.count({
    where: {
      playerId,
      report: {
        eventMatchId: { in: completedReportMatchIds },
        status: { in: completedStatuses },
      },
    },
  });

  return {
    category,
    appearances: actuals,
    goals,
    assists,
  };
}

export async function getBatchPlayerCategoryStats(
  playerIds: string[],
  leagueSeasonId?: string,
): Promise<Map<string, PlayerCategoryStats>> {
  const result = new Map<string, PlayerCategoryStats>();
  for (const playerId of playerIds) {
    result.set(playerId, await getPlayerCategoryStats(playerId, leagueSeasonId));
  }
  return result;
}