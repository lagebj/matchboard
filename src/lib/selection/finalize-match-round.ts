import { WarningSeverity, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";

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
  overrideReason?: string,
): Promise<FinalizeResult> {
  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        select: { id: true },
      },
      warnings: {
        select: {
          id: true,
          severity: true,
          rule: true,
          message: true,
          resolved: true,
        },
      },
    },
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

  const unresolvedWarnings = matchRound.warnings.filter((w) => !w.resolved);

  const hardBlockWarnings = unresolvedWarnings.filter(
    (w) => w.severity === WarningSeverity.HARD_BLOCK,
  );
  const requiresOverrideWarnings = unresolvedWarnings.filter(
    (w) => w.severity === WarningSeverity.REQUIRES_OVERRIDE,
  );

  if (hardBlockWarnings.length > 0) {
    const hardBlockMessages = hardBlockWarnings.map(
      (w) => `[HARD_BLOCK] ${w.rule}: ${w.message}`,
    );

    return {
      success: false,
      warnings: hardBlockMessages,
      hardBlocked: true,
      needsOverride: false,
      humanReviewRecommended: true,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }

  if (requiresOverrideWarnings.length > 0 && (!overrideReason || overrideReason.trim().length === 0)) {
    const overrideMessages = requiresOverrideWarnings.map(
      (w) => `[REQUIRES_OVERRIDE] ${w.rule}: ${w.message}`,
    );

    return {
      success: false,
      warnings: overrideMessages,
      hardBlocked: false,
      needsOverride: true,
      humanReviewRecommended: false,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }

  const warningCountWarnings = unresolvedWarnings.filter(
    (w) => w.severity === WarningSeverity.WARNING || w.severity === WarningSeverity.SCORING_PREFERENCE,
  );

  const humanReviewRecommended = warningCountWarnings.length > rules.warningThreshold;

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
        overrideReason: requiresOverrideWarnings.length > 0 ? overrideReason : null,
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

  const allWarningMessages = unresolvedWarnings.map((w) => {
    const severity = w.severity as string;
    return `[${severity}] ${w.rule}: ${w.message}`;
  });

  const finalizedMatchIds = [...new Set(draftSelections.map((s) => s.matchId))];

  return {
    success: true,
    warnings: allWarningMessages,
    hardBlocked: false,
    needsOverride: false,
    humanReviewRecommended,
    finalizedSelectionCount: draftSelections.length,
    finalizedMatchIds,
  };
}