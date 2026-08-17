import { type Prisma, type SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatOverrideReason, toPrismaCategory } from "@/lib/selection/override-reason-utils";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export type FinalizedSelectionEditResult = {
  success: boolean;
  error?: string;
  auditEntryId?: string;
};

export async function editFinalizedSelection(
  selectionId: string,
  changeReason: string,
  updatedData: {
    role?: SelectionRole;
    playerId?: string;
    explanation?: Record<string, unknown>;
    overrideReasonCategory?: OverrideReasonCategory;
    overrideReasonDetail?: string;
  },
): Promise<FinalizedSelectionEditResult> {
  if (!changeReason || changeReason.trim().length === 0) {
    return {
      success: false,
      error: "A reason is required when editing a finalised selection.",
    };
  }

  const selection = await db.selection.findFirst({
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
      organisationId: true,
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
      error: "Only finalised selections require an audit reason for editing.",
    };
  }

  const auditEntry = await db.$transaction(async (tx) => {
    const audit = await tx.selectionAudit.create({
      data: {
        organisationId: selection.organisationId,
        selectionId,
        changeReason,
        previousRole: selection.role,
        previousStatus: selection.status,
      },
    });

    await tx.selection.update({
      where: { id: selectionId },
      data: {
        ...(updatedData.role ? { role: updatedData.role } : {}),
        ...(updatedData.playerId ? { playerId: updatedData.playerId } : {}),
        ...(updatedData.explanation !== undefined ? { explanation: updatedData.explanation as Prisma.InputJsonValue } : {}),
        overrideReason: updatedData.overrideReasonCategory
          ? formatOverrideReason(updatedData.overrideReasonCategory, updatedData.overrideReasonDetail)
          : changeReason,
        ...(updatedData.overrideReasonCategory ? { overrideReasonCategory: toPrismaCategory(updatedData.overrideReasonCategory) } : {}),
        ...(updatedData.overrideReasonDetail !== undefined ? { overrideReasonDetail: updatedData.overrideReasonDetail ?? null } : {}),
      },
    });

    return audit;
  });

  return {
    success: true,
    auditEntryId: auditEntry.id,
  };
}