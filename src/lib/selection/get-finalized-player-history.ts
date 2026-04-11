import { type SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type FinalizedPlayerHistoryEntry = {
  matchDate: Date;
  matchId: string;
  roleType: SelectionRole;
  targetTeamName: string;
};

export async function getFinalizedPlayerHistory(
  playerId: string,
  currentMatchId: string,
  currentMatchDate: Date,
): Promise<FinalizedPlayerHistoryEntry[]> {
  const history = await db.matchSelectionPlayer.findMany({
    where: {
      playerId,
      wasManuallyRemoved: false,
      selection: {
        status: SelectionStatus.FINALIZED,
        matchId: {
          not: currentMatchId,
        },
        match: {
          startsAt: {
            lte: currentMatchDate,
          },
        },
      },
    },
    select: {
      roleType: true,
      targetTeamNameSnapshot: true,
      selection: {
        select: {
          match: {
            select: {
              id: true,
              startsAt: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        selection: {
          match: {
            startsAt: "desc",
          },
        },
      },
    ],
  });

  return history.map((entry) => ({
    matchDate: entry.selection.match.startsAt,
    matchId: entry.selection.match.id,
    roleType: entry.roleType,
    targetTeamName: entry.targetTeamNameSnapshot,
  }));
}
