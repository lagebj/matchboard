import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
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
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      matchRoundId: true,
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
  });

  const remainingFinalized = await db.selection.count({
    where: {
      matchRoundId,
      status: SelectionStatus.FINALIZED,
    },
  });

  let roundStatusReverted = false;

  if (remainingFinalized === 0) {
    const integrity = await computeRoundPlanIntegrity(matchRoundId);

    const blockedSignalCount = integrity.summary.blockerCount + integrity.summary.decisionRequiredCount;

    const newStatus = deriveRoundStatus({
      dbStatus: "DRAFT",
      hasDraftSelections: true,
      hasMatches: true,
      blockedSignalCount,
    });

    await db.matchRound.update({
      where: { id: matchRoundId },
      data: { status: newStatus },
    });

    roundStatusReverted = true;
  }

  return {
    success: true,
    message: `Un-finalized ${finalizedSelections.length} selections.`,
    unfinalizedSelectionCount: finalizedSelections.length,
    matchId,
    roundStatusReverted,
  };
}