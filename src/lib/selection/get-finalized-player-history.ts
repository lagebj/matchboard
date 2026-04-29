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
  const history = await db.selection.findMany({
    where: {
      playerId,
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
    select: {
      role: true,
      match: {
        select: {
          id: true,
          startsAt: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        match: {
          startsAt: "desc",
        },
      },
    ],
  });

  return history.map((entry) => ({
    matchDate: entry.match.startsAt,
    matchId: entry.match.id,
    roleType: entry.role,
    targetTeamName: entry.match.team.name,
  }));
}
