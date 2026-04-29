import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type FinalizedSelectionEditResult = {
  success: boolean;
  error?: string;
  auditEntryId?: string;
};

export async function editFinalizedSelection(
  selectionId: string,
  changeReason: string,
  updatedData: {
    role?: string;
    playerId?: string;
    explanation?: unknown;
  },
): Promise<FinalizedSelectionEditResult> {
  if (!changeReason || changeReason.trim().length === 0) {
    return {
      success: false,
      error: "A reason is required when editing a finalized selection.",
    };
  }

  const selection = await db.selection.findUnique({
    where: { id: selectionId },
    select: {
      id: true,
      matchId: true,
      matchRoundId: true,
      status: true,
      playerId: true,
      role: true,
      explanation: true,
      overrideReason: true,
      ruleConfigVersion: true,
    },
  });

  if (!selection) {
    return {
      success: false,
      error: "Selection not found.",
    };
  }

  if (selection.status !== SelectionStatus.FINALIZED) {
    return {
      success: false,
      error: "Only finalized selections require an audit reason for editing.",
    };
  }

  const auditEntry = await db.$transaction(async (tx) => {
    const audit = await tx.selectionAudit.create({
      data: {
        selectionId,
        changeReason,
        previousRole: selection.role,
        previousStatus: selection.status,
      },
    });

    await tx.selection.update({
      where: { id: selectionId },
      data: {
        ...(updatedData.role ? { role: updatedData.role as any } : {}),
        ...(updatedData.playerId ? { playerId: updatedData.playerId } : {}),
        ...(updatedData.explanation !== undefined ? { explanation: updatedData.explanation as any } : {}),
        overrideReason: changeReason,
      },
    });

    return audit;
  });

  return {
    success: true,
    auditEntryId: auditEntry.id,
  };
}