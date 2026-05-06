import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type ConsecutiveSupportResult = {
  consecutiveSupportRounds: number;
  totalSupportRounds: number;
};

export async function getConsecutiveSupportCount(
  playerId: string,
  currentMatchDate: Date,
): Promise<ConsecutiveSupportResult> {
  const supportSelections = await db.selection.findMany({
    where: {
      playerId,
      status: SelectionStatus.FINALIZED,
      role: SelectionRole.SUPPORT,
      match: {
        startsAt: {
          lt: currentMatchDate,
        },
      },
    },
    select: {
      matchRoundId: true,
      match: {
        select: {
          startsAt: true,
        },
      },
    },
    orderBy: {
      match: {
        startsAt: "desc",
      },
    },
  });

  const uniqueRoundIds = [...new Set(supportSelections.map((s) => s.matchRoundId))];
  let consecutive = 0;

  if (uniqueRoundIds.length > 0) {
    const allRecentSelections = await db.selection.findMany({
      where: {
        playerId,
        status: SelectionStatus.FINALIZED,
        match: {
          startsAt: {
            lt: currentMatchDate,
          },
        },
      },
      select: {
        matchRoundId: true,
        role: true,
        match: {
          select: {
            startsAt: true,
          },
        },
      },
      orderBy: {
        match: {
          startsAt: "desc",
        },
      },
    });

    const roundsByDate = new Map<string, string>();
    for (const s of allRecentSelections) {
      roundsByDate.set(s.matchRoundId, s.match.startsAt.toISOString());
    }

    const sortedRoundIds = [...roundsByDate.entries()]
      .sort(([, a], [, b]) => b.localeCompare(a))
      .map(([id]) => id);

    const roleByRound = new Map<string, Set<string>>();
    for (const s of allRecentSelections) {
      if (!roleByRound.has(s.matchRoundId)) {
        roleByRound.set(s.matchRoundId, new Set());
      }
      roleByRound.get(s.matchRoundId)!.add(s.role);
    }

    for (const roundId of sortedRoundIds) {
      const roles = roleByRound.get(roundId);
      if (roles && roles.has(SelectionRole.SUPPORT)) {
        consecutive++;
      } else {
        break;
      }
    }
  }

  return {
    consecutiveSupportRounds: consecutive,
    totalSupportRounds: uniqueRoundIds.length,
  };
}