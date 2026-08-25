import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { unfinalizeSelectionsForScope, unfinalizeRoundRecord } from "@/lib/selection/round-finalization-transitions";

export type UnfinalizeResult = {
  success: boolean;
  message: string;
  unfinalizedSelectionCount: number;
  matchRoundId: string;
};

export async function unfinalizeMatchRound(
  matchRoundId: string,
): Promise<UnfinalizeResult> {
  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: {
      id: true,
      status: true,
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
    await unfinalizeSelectionsForScope(tx, { matchRoundId });
  });

  await unfinalizeRoundRecord(db, matchRoundId);

  return {
    success: true,
    message: `Un-finalized ${finalizedSelections} selections.`,
    unfinalizedSelectionCount: finalizedSelections,
    matchRoundId,
  };
}