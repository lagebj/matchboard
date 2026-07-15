import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import type { InsightOverview } from "@/lib/insights/insights-types";

export async function getInsightOverview(
  leagueSeasonId: string,
): Promise<InsightOverview> {
  await requireCoachAccess();

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId },
    select: { id: true },
  });
  const roundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: { matchRoundId: { in: roundIds } },
    select: { id: true },
  });
  const matchIds = matches.map((m) => m.id);

  const activePlayers = await db.player.count({
    where: { active: true, removedAt: null },
  });

  const playersWithoutOpportunity = await db.player.count({
    where: {
      active: true,
      removedAt: null,
      selections: { none: { match: { matchRoundId: { in: roundIds } } } },
      availabilities: {
        none: {
          matchRoundId: { in: roundIds },
          status: "UNAVAILABLE",
        },
      },
    },
  });

  const playersWithHighLoad = await db.$queryRaw<number[]>`
    SELECT COUNT(*)::int FROM (
      SELECT p.id, COUNT(s.id) as sel_count
      FROM "Player" p
      INNER JOIN "Selection" s ON s."playerId" = p.id
      INNER JOIN "Match" m ON s."matchId" = m.id
      WHERE p.active = true
        AND p."removedAt" IS NULL
        AND m."matchRoundId" = ANY(${roundIds}::text[])
        AND s.status IN ('FINALIZED', 'DRAFT')
      GROUP BY p.id
      HAVING COUNT(s.id) >= 4
    ) sub
  `;

  const completedReports = await db.postMatchReport.count({
    where: {
      matchId: { in: matchIds },
      status: { in: ["REPORTED", "LOCKED"] },
    },
  });
  const totalMatches = matchIds.length;
  const matchesWithMissingReports = totalMatches - completedReports;

  const planIntegrityCount = await db.warning.count({
    where: {
      matchRoundId: { in: roundIds },
      severity: { in: ["HARD_BLOCK", "REQUIRES_OVERRIDE"] },
    },
  });

  return {
    totalPlayers: activePlayers,
    playersWithNoOpportunity: playersWithoutOpportunity,
    playersWithHighLoad: playersWithHighLoad[0] ?? 0,
    matchesWithMissingReports,
    matchesWithCoverageWarnings: 0,
    policyWarningsCount: planIntegrityCount,
    plannedActualDeltasCount: 0,
    conflictsCount: 0,
  };
}