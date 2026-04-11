import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCalendarDayDifference, isSameCalendarDay } from "@/lib/date-utils";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";

type CoreMatchDropHistoryOptions = {
  blockCoreMatchIfFloatingWithinDays: number;
  coreTeamId: string;
  currentMatchDate: Date;
  currentMatchId: string;
  minDaysBetweenAnyMatches: number;
  playerId: string;
};

export async function getCoreMatchDropHistory({
  blockCoreMatchIfFloatingWithinDays,
  coreTeamId,
  currentMatchDate,
  currentMatchId,
  minDaysBetweenAnyMatches,
  playerId,
}: CoreMatchDropHistoryOptions): Promise<number> {
  const [coreTeamSelections, playerHistory] = await Promise.all([
    db.matchSelection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
        matchId: {
          not: currentMatchId,
        },
        match: {
          startsAt: {
            lt: currentMatchDate,
          },
          targetTeamId: coreTeamId,
        },
      },
      select: {
        matchId: true,
        match: {
          select: {
            startsAt: true,
            squadSize: true,
          },
        },
        players: {
          select: {
            playerId: true,
            wasManuallyRemoved: true,
          },
        },
      },
      orderBy: [
        {
          match: {
            startsAt: "asc",
          },
        },
      ],
    }),
    getFinalizedPlayerHistory(playerId, currentMatchId, currentMatchDate),
  ]);

  const playerHistoryByMatchId = new Map(
    playerHistory.map((historyEntry) => [historyEntry.matchId, historyEntry]),
  );
  let inferredDroppedCoreMatches = 0;

  for (const selection of coreTeamSelections) {
    if (playerHistoryByMatchId.has(selection.matchId)) {
      continue;
    }

    const finalizedPlayers = selection.players.filter((player) => !player.wasManuallyRemoved);

    if (finalizedPlayers.length < selection.match.squadSize) {
      continue;
    }

    const latestSelectedAppearance = playerHistory.find(
      (historyEntry) => historyEntry.matchDate < selection.match.startsAt,
    );

    if (latestSelectedAppearance) {
      if (isSameCalendarDay(selection.match.startsAt, latestSelectedAppearance.matchDate)) {
        continue;
      }

      const daysSinceLastMatch = getCalendarDayDifference(
        selection.match.startsAt,
        latestSelectedAppearance.matchDate,
      );

      if (
        isFloatingSelectionRole(latestSelectedAppearance.roleType) &&
        daysSinceLastMatch <= blockCoreMatchIfFloatingWithinDays
      ) {
        continue;
      }

      if (daysSinceLastMatch < minDaysBetweenAnyMatches) {
        continue;
      }
    }

    inferredDroppedCoreMatches += 1;
  }

  return inferredDroppedCoreMatches;
}
