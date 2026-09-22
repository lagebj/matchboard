import "server-only";
import { db } from "@/lib/db";
import type { TeamHistoryContext } from "./types";

/**
 * Formation familiarity and lineup continuity (bundle §6: "formation familiarity", "lineup
 * continuity/change"). Deliberately simple, self-contained queries over `Match`/`Selection` —
 * this module does not depend on any lifecycle-status helper; "recent matches" is defined
 * directly as the team's last `FORMATION_WINDOW` non-cancelled matches before this one, which is
 * both simpler and correct regardless of report-completion state (a match's `formation` is set at
 * planning time, independent of whether its report was ever completed).
 */

const FORMATION_WINDOW = 5;

export async function buildTeamHistoryContext(params: {
  teamId: string;
  organisationId: string;
  excludeMatchId: string;
  matchStartsAt: Date;
  currentFormation: string | null;
  currentCoreSquad: string[];
}): Promise<TeamHistoryContext> {
  const recentMatches = await db.match.findMany({
    where: {
      teamId: params.teamId,
      organisationId: params.organisationId,
      id: { not: params.excludeMatchId },
      startsAt: { lt: params.matchStartsAt },
      status: { not: "CANCELLED" },
    },
    orderBy: { startsAt: "desc" },
    take: FORMATION_WINDOW,
    select: { id: true, formation: true },
  });

  const formationFamiliarity =
    params.currentFormation && recentMatches.length > 0
      ? {
          formation: params.currentFormation,
          matchesUsedInWindow: recentMatches.filter((m) => m.formation === params.currentFormation).length,
          windowSize: recentMatches.length,
        }
      : null;

  const previousMatch = recentMatches[0] ?? null;
  let lineupContinuity: TeamHistoryContext["lineupContinuity"] = {
    previousMatchId: null,
    unchangedPlayerCount: 0,
    changedPlayerCount: 0,
    previousSquadSize: 0,
  };

  if (previousMatch) {
    const previousSelections = await db.selection.findMany({
      where: { matchId: previousMatch.id, organisationId: params.organisationId, role: "CORE", status: "FINALIZED" },
      select: { playerId: true },
    });
    const previousCoreIds = new Set(previousSelections.map((s) => s.playerId));
    const currentSet = new Set(params.currentCoreSquad);
    const unchangedPlayerCount = [...currentSet].filter((id) => previousCoreIds.has(id)).length;

    lineupContinuity = {
      previousMatchId: previousMatch.id,
      unchangedPlayerCount,
      changedPlayerCount: currentSet.size - unchangedPlayerCount,
      previousSquadSize: previousCoreIds.size,
    };
  }

  return { formationFamiliarity, lineupContinuity };
}
