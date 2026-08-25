import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { unfinalizeSelectionsForScope, unfinalizeRoundRecord } from "@/lib/selection/round-finalization-transitions";

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
    await unfinalizeSelectionsForScope(tx, { matchId });
  });

  const remainingFinalized = await db.selection.count({
    where: {
      matchRoundId,
      status: SelectionStatus.FINALIZED,
    },
  });

  let roundStatusReverted = false;

  if (remainingFinalized === 0) {
    await unfinalizeRoundRecord(db, matchRoundId);
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