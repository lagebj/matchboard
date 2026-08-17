import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { formatOverrideReason, toPrismaCategory } from "@/lib/selection/override-reason-utils";

export type FinalizeResult = {
  success: boolean;
  warnings: string[];
  hardBlocked: boolean;
  needsOverride: boolean;
  humanReviewRecommended: boolean;
  finalizedSelectionCount: number;
  finalizedMatchIds: string[];
};

export async function finalizeMatchRound(
  matchRoundId: string,
  overrideReasonCategory?: OverrideReasonCategory,
  overrideReasonDetail?: string,
): Promise<FinalizeResult> {
  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { id: true },
  });

  if (!matchRound) {
    return {
      success: false,
      warnings: ["Match round not found."],
      hardBlocked: true,
      needsOverride: false,
      humanReviewRecommended: false,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }

  const rules = await getRules();

  const integrity = await computeRoundPlanIntegrity(matchRoundId);

  const blockedSignals = integrity.signals.filter((s) => s.kind === "BLOCKED");
  const decisionRequiredSignals = integrity.signals.filter((s) => s.kind === "DECISION_REQUIRED");

  const allOverrideSignals = [...blockedSignals, ...decisionRequiredSignals];

  if (allOverrideSignals.length > 0 && !overrideReasonCategory) {
    const overrideMessages = allOverrideSignals.map(
      (s) => `[${s.kind}] ${s.ruleCode}: ${s.title}`,
    );

    return {
      success: false,
      warnings: overrideMessages,
      hardBlocked: false,
      needsOverride: true,
      humanReviewRecommended: true,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }

  const hasHardOverrides = allOverrideSignals.length > 0;

  const formattedOverrideReason = overrideReasonCategory
    ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail)
    : null;

  const humanReviewRecommended = integrity.planningNotes.length > rules.warningThreshold;

  const draftSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      id: true,
      matchId: true,
    },
  });

  if (draftSelections.length === 0) {
    return {
      success: false,
      warnings: ["No draft selections found in this match round."],
      hardBlocked: false,
      needsOverride: false,
      humanReviewRecommended: false,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }

  const currentRuleConfigVersion = rules.version;

  await db.$transaction(async (tx) => {
    await tx.selection.updateMany({
      where: {
        matchRoundId,
        status: SelectionStatus.DRAFT,
      },
      data: {
        status: SelectionStatus.FINALIZED,
        ruleConfigVersion: currentRuleConfigVersion,
        overrideReason: hasHardOverrides ? formattedOverrideReason : null,
        overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : null,
        overrideReasonDetail: overrideReasonDetail ?? null,
      },
    });

    await tx.movementLedger.updateMany({
      where: {
        matchRoundId,
        isDraft: true,
      },
      data: {
        isDraft: false,
      },
    });

    await tx.matchRound.update({
      where: { id: matchRoundId },
      data: { status: "FINALIZED" },
    });

    await tx.ruleConfig.update({
      where: { id: rules.id },
      data: { version: currentRuleConfigVersion + 1 },
    });
  });

  const allWarningMessages = allOverrideSignals.map((s) => {
    return `[${s.kind}] ${s.ruleCode}: ${s.title}`;
  });

  const planningNoteMessages = integrity.planningNotes.map((n) => {
    return `[PLANNING_NOTE] ${n.code}: ${n.title}`;
  });

  const finalizedMatchIds = [...new Set(draftSelections.map((s) => s.matchId))];

  return {
    success: true,
    warnings: [...allWarningMessages, ...planningNoteMessages],
    hardBlocked: false,
    needsOverride: false,
    humanReviewRecommended,
    finalizedSelectionCount: draftSelections.length,
    finalizedMatchIds,
  };
}