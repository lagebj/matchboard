import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isFloatingSelectionRole } from "@/lib/match-utils";

export type FloatingHistory = {
  lastFinalizedMatchDate: Date | null;
  lastFinalizedRoleType: SelectionRole | null;
  totalFloatingMatches: number;
};

export async function getFloatingHistory(
  playerId: string,
  currentMatchDate: Date,
): Promise<FloatingHistory> {
  const [historicalSelections, lastFinalizedSelection] = await Promise.all([
    db.matchSelectionPlayer.findMany({
      where: {
        playerId,
        wasManuallyRemoved: false,
        selection: {
          status: SelectionStatus.FINALIZED,
          match: {
            startsAt: {
              lt: currentMatchDate,
            },
          },
        },
      },
      select: {
        roleType: true,
      },
    }),
    db.matchSelectionPlayer.findFirst({
      where: {
        playerId,
        wasManuallyRemoved: false,
        selection: {
          status: SelectionStatus.FINALIZED,
          match: {
            startsAt: {
              lt: currentMatchDate,
            },
          },
        },
      },
      select: {
        roleType: true,
        selection: {
          select: {
            match: {
              select: {
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
    }),
  ]);

  return {
    lastFinalizedMatchDate: lastFinalizedSelection?.selection.match.startsAt ?? null,
    lastFinalizedRoleType: lastFinalizedSelection?.roleType ?? null,
    totalFloatingMatches: historicalSelections.filter((selection) =>
      isFloatingSelectionRole(selection.roleType),
    ).length,
  };
}
