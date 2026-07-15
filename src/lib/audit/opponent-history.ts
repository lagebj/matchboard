import "server-only";

import { db } from "@/lib/db";

export type OpponentMatchRecord = {
  matchId: string;
  matchDate: Date | null;
  opponent: string;
  homeAway: string;
  isCancelled: boolean;
  reportStatus: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  result: "won" | "drawn" | "lost" | null;
};

export type OpponentHistoryData = {
  opponentTeamId: string;
  opponentDisplayName: string;
  matches: OpponentMatchRecord[];
  totalPlayed: number;
  totalWon: number;
  totalDrawn: number;
  totalLost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export async function getOpponentHistory(
  opponentTeamId: string,
  leagueSeasonId: string,
): Promise<OpponentHistoryData | null> {
  const opponentTeam = await db.opponentTeam.findUnique({
    where: { id: opponentTeamId },
    select: { id: true, displayName: true },
  });

  if (!opponentTeam) return null;

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId },
    select: { id: true },
  });

  const matchRoundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: matchRoundIds },
      opponentTeamId,
    },
    include: {
      opponentTeam: { select: { displayName: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const matchIds = matches.map((m) => m.id);

  const reports = await db.postMatchReport.findMany({
    where: {
      matchId: { in: matchIds },
      status: { in: ["REPORTED", "LOCKED"] },
    },
    select: { id: true, matchId: true, status: true, homeGoals: true, awayGoals: true },
  });

  const reportByMatchId = new Map(reports.map((r) => [r.matchId, r]));

  const records: OpponentMatchRecord[] = [];
  let totalWon = 0;
  let totalDrawn = 0;
  let totalLost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    const report = reportByMatchId.get(match.id);
    let result: "won" | "drawn" | "lost" | null = null;
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;

    if (report) {
      homeGoals = report.homeGoals;
      awayGoals = report.awayGoals;
      const isHome = match.homeAway === "HOME";
      if (homeGoals !== null && awayGoals !== null) {
        if (homeGoals > awayGoals) {
          result = isHome ? "won" : "lost";
        } else if (homeGoals < awayGoals) {
          result = isHome ? "lost" : "won";
        } else {
          result = "drawn";
        }

        if (result === "won") totalWon++;
        else if (result === "drawn") totalDrawn++;
        else if (result === "lost") totalLost++;

        if (isHome) {
          goalsFor += homeGoals;
          goalsAgainst += awayGoals;
        } else {
          goalsFor += awayGoals;
          goalsAgainst += homeGoals;
        }
      }
    }

    records.push({
      matchId: match.id,
      matchDate: match.startsAt,
      opponent: match.opponentTeam?.displayName ?? match.opponent,
      homeAway: match.homeAway,
      isCancelled: match.status === "CANCELLED",
      reportStatus: report?.status ?? null,
      homeGoals,
      awayGoals,
      result,
    });
  }

  return {
    opponentTeamId: opponentTeam.id,
    opponentDisplayName: opponentTeam.displayName,
    matches: records,
    totalPlayed: totalWon + totalDrawn + totalLost,
    totalWon,
    totalDrawn,
    totalLost,
    goalsFor,
    goalsAgainst,
  };
}