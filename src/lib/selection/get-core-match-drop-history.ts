import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCalendarDayDifference, isSameCalendarDay } from "@/lib/date-utils";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";

type CoreMatchDropHistoryOptions = {
  coreTeamId: string;
  currentMatchDate: Date;
  currentMatchId: string;
  minDaysBetweenAnyMatches: number;
  playerId: string;
};

export async function getCoreMatchDropHistory({
  coreTeamId,
  currentMatchDate,
  currentMatchId,
  minDaysBetweenAnyMatches,
  playerId,
}: CoreMatchDropHistoryOptions): Promise<number> {
  const [coreTeamSelections, playerHistory] = await Promise.all([
    db.selection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
        matchId: {
          not: currentMatchId,
        },
        match: {
          startsAt: {
            lt: currentMatchDate,
          },
          teamId: coreTeamId,
        },
      },
      select: {
        matchId: true,
        match: {
          select: {
            startsAt: true,
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

  const uniqueMatchSelections = new Map<string, { matchId: string; matchStartsAt: Date }>();
  for (const selection of coreTeamSelections) {
    if (!uniqueMatchSelections.has(selection.matchId)) {
      uniqueMatchSelections.set(selection.matchId, {
        matchId: selection.matchId,
        matchStartsAt: selection.match.startsAt,
      });
    }
  }

  for (const matchEntry of uniqueMatchSelections.values()) {
    if (playerHistoryByMatchId.has(matchEntry.matchId)) {
      continue;
    }

    const latestSelectedAppearance = playerHistory.find(
      (historyEntry) => historyEntry.matchDate < matchEntry.matchStartsAt,
    );

    if (latestSelectedAppearance) {
      if (isSameCalendarDay(matchEntry.matchStartsAt, latestSelectedAppearance.matchDate)) {
        continue;
      }

      const daysSinceLastMatch = getCalendarDayDifference(
        matchEntry.matchStartsAt,
        latestSelectedAppearance.matchDate,
      );

      if (daysSinceLastMatch < minDaysBetweenAnyMatches) {
        continue;
      }
    }

    inferredDroppedCoreMatches += 1;
  }

  return inferredDroppedCoreMatches;
}