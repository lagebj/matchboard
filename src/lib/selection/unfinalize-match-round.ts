import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
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
    select: {
      id: true,
      status: true,
      matches: { select: { id: true } },
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

  const finalizedSelections = await db.selection.count({
    where: {
      matchRoundId,
      status: SelectionStatus.FINALIZED,
    },
  });

  if (finalizedSelections === 0) {
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
        overrideReasonCategory: null,
        overrideReasonDetail: null,
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
  });

  const integrity = await computeRoundPlanIntegrity(matchRoundId);

  const blockedSignalCount = integrity.summary.blockerCount + integrity.summary.decisionRequiredCount;

  const newStatus = deriveRoundStatus({
    dbStatus: "DRAFT",
    hasDraftSelections: true,
    hasMatches: matchRound.matches.length > 0,
    blockedSignalCount,
  });

  await db.matchRound.update({
    where: { id: matchRoundId },
    data: { status: newStatus },
  });

  return {
    success: true,
    message: `Un-finalized ${finalizedSelections} selections.`,
    unfinalizedSelectionCount: finalizedSelections,
    matchRoundId,
  };
}