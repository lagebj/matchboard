import { db } from "@/lib/db";
import type { FootballMatchRef } from "../football-match-ref";

/**
 * Builds the canonical ref for a League match, resolving its evidence league season via
 * the match's round (matchRoundId -> matchRound.leagueSeasonId), exactly as
 * `completeReport()` resolved it inline before ADR-0104.
 */
export async function buildLeagueMatchRef(matchId: string): Promise<FootballMatchRef> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { matchRoundId: true },
  });

  let leagueSeasonId: string | null = null;
  if (match?.matchRoundId) {
    const round = await db.matchRound.findUnique({
      where: { id: match.matchRoundId },
      select: { leagueSeasonId: true },
    });
    leagueSeasonId = round?.leagueSeasonId ?? null;
  }

  return { kind: "LEAGUE_MATCH", matchId, leagueSeasonId };
}
