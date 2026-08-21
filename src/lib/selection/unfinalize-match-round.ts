import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

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

  // The persisted status is always the literal DRAFT after un-finalizing — BLOCKED/READY/
  // NOT_GENERATED are UI-derived display states computed live by deriveRoundStatus(), never
  // values the database column itself should hold (see round-status.ts and the MatchRoundStatus
  // enum this column now uses).
  await db.matchRound.update({
    where: { id: matchRoundId },
    data: { status: "DRAFT" },
  });

  return {
    success: true,
    message: `Un-finalized ${finalizedSelections} selections.`,
    unfinalizedSelectionCount: finalizedSelections,
    matchRoundId,
  };
}