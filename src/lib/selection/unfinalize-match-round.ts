import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deriveRoundStatus } from "@/lib/round-status";

export type UnfinalizeResult = {
  success: boolean;
  message: string;
  unfinalizedSelectionCount: number;
  matchRoundId: string;
};

export async function unfinalizeMatchRound(
  matchRoundId: string,
): Promise<UnfinalizeResult> {
  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: { select: { id: true } },
      warnings: {
        select: {
          id: true,
          severity: true,
          resolved: true,
        },
      },
      selections: {
        where: { status: SelectionStatus.FINALIZED },
        select: { id: true },
      },
    },
  });

  if (!matchRound) {
    return {
      success: false,
      message: "Match round not found.",
      unfinalizedSelectionCount: 0,
      matchRoundId,
    };
  }

  if (matchRound.status !== "FINALIZED") {
    return {
      success: false,
      message: "Only finalized rounds can be un-finalized.",
      unfinalizedSelectionCount: 0,
      matchRoundId,
    };
  }

  if (matchRound.selections.length === 0) {
    return {
      success: false,
      message: "No finalized selections found in this match round.",
      unfinalizedSelectionCount: 0,
      matchRoundId,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.selection.updateMany({
      where: {
        matchRoundId,
        status: SelectionStatus.FINALIZED,
      },
      data: {
        status: SelectionStatus.DRAFT,
        ruleConfigVersion: null,
        overrideReason: null,
      },
    });

    await tx.movementLedger.updateMany({
      where: {
        matchRoundId,
        isDraft: false,
      },
      data: {
        isDraft: true,
      },
    });

    const unresolvedBlocking = matchRound.warnings.filter(
      (w) =>
        !w.resolved &&
        (w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE"),
    ).length;

    const newStatus = deriveRoundStatus({
      dbStatus: "DRAFT",
      hasDraftSelections: true,
      hasMatches: matchRound.matches.length > 0,
      blockingWarningCount: unresolvedBlocking,
    });

    await tx.matchRound.update({
      where: { id: matchRoundId },
      data: { status: newStatus },
    });
  });

  return {
    success: true,
    message: `Un-finalized ${matchRound.selections.length} selections.`,
    unfinalizedSelectionCount: matchRound.selections.length,
    matchRoundId,
  };
}