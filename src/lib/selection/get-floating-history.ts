import { type SelectionRole, SelectionStatus } from "@/generated/prisma/client";
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
    db.selection.findMany({
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
        role: true,
      },
    }),
    db.selection.findFirst({
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
        role: true,
        match: {
          select: {
            startsAt: true,
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
    }),
  ]);

  return {
    lastFinalizedMatchDate: lastFinalizedSelection?.match.startsAt ?? null,
    lastFinalizedRoleType: lastFinalizedSelection?.role ?? null,
    totalFloatingMatches: historicalSelections.filter((selection) =>
      isFloatingSelectionRole(selection.role),
    ).length,
  };
}
