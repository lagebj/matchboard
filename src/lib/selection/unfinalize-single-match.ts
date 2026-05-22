import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deriveRoundStatus } from "@/lib/round-status";

export type UnfinalizeSingleMatchResult = {
  success: boolean;
  message: string;
  unfinalizedSelectionCount: number;
  matchId: string;
  roundStatusReverted: boolean;
};

export async function unfinalizeSingleMatch(
  matchId: string,
): Promise<UnfinalizeSingleMatchResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      matchRound: {
        include: {
          matches: { select: { id: true } },
          warnings: {
            select: {
              id: true,
              severity: true,
              resolved: true,
            },
          },
        },
      },
    },
  });

  if (!match) {
    return {
      success: false,
      message: "Match not found.",
      unfinalizedSelectionCount: 0,
      matchId,
      roundStatusReverted: false,
    };
  }

  const matchRoundId = match.matchRoundId;

  const finalizedSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.FINALIZED,
    },
    select: { id: true },
  });

  if (finalizedSelections.length === 0) {
    return {
      success: false,
      message: "No finalized selections found for this match.",
      unfinalizedSelectionCount: 0,
      matchId,
      roundStatusReverted: false,
    };
  }

  let roundStatusReverted = false;

  await db.$transaction(async (tx) => {
    await tx.selection.updateMany({
      where: {
        matchId,
        status: SelectionStatus.FINALIZED,
      },
      data: {
        status: SelectionStatus.DRAFT,
        ruleConfigVersion: null,
        overrideReason: null,
        overrideReasonCategory: null,
        overrideReasonDetail: null,
      },
    });

    await tx.movementLedger.updateMany({
      where: {
        matchId,
        isDraft: false,
      },
      data: {
        isDraft: true,
      },
    });

    const round = match.matchRound;

    if (round.status === "FINALIZED") {
      const remainingFinalized = await tx.selection.count({
        where: {
          matchRoundId,
          status: SelectionStatus.FINALIZED,
        },
      });

      if (remainingFinalized === 0) {
        const unresolvedBlocking = round.warnings.filter(
          (w) =>
            !w.resolved &&
            (w.severity === "HARD_BLOCK" ||
              w.severity === "REQUIRES_OVERRIDE"),
        ).length;

        const newStatus = deriveRoundStatus({
          dbStatus: "DRAFT",
          hasDraftSelections: true,
          hasMatches: round.matches.length > 0,
          blockedSignalCount: unresolvedBlocking,
        });

        await tx.matchRound.update({
          where: { id: matchRoundId },
          data: { status: newStatus },
        });

        roundStatusReverted = true;
      }
    }
  });

  return {
    success: true,
    message: `Un-finalized ${finalizedSelections.length} selections.`,
    unfinalizedSelectionCount: finalizedSelections.length,
    matchId,
    roundStatusReverted,
  };
}