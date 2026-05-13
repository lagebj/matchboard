import { WarningSeverity, SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";
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

  const allOverrideWarnings = [...hardBlockWarnings, ...requiresOverrideWarnings];

  if (allOverrideWarnings.length > 0 && (!overrideReasonCategory)) {
    const overrideMessages = allOverrideWarnings.map(
      (w) => `[${w.severity as string}] ${w.rule}: ${w.message}`,
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

  const hasHardOverrides = allOverrideWarnings.some(
    (w) => w.severity === WarningSeverity.HARD_BLOCK || w.severity === WarningSeverity.REQUIRES_OVERRIDE,
  );

  const formattedOverrideReason = overrideReasonCategory
    ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail)
    : null;

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

  const nonCoreDraftSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
      role: { not: SelectionRole.CORE },
    },
    select: {
      playerId: true,
      matchId: true,
      role: true,
    },
  });

  // Legacy: controlledDoubleLoad was a previous-generation concept.
  // No new true values are written by the engine. This query handles
  // any remaining legacy data from before the match-first refactor.
  const controlledDoubleLoadSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
      controlledDoubleLoad: true,
    },
    select: {
      playerId: true,
      matchId: true,
    },
  });

  const allNonCorePlayerKeys = new Set<string>();
  for (const s of nonCoreDraftSelections) {
    allNonCorePlayerKeys.add(`${s.playerId}:${s.matchId}`);
  }
  for (const s of controlledDoubleLoadSelections) {
    allNonCorePlayerKeys.add(`${s.playerId}:${s.matchId}`);
  }

  if (allNonCorePlayerKeys.size > 0) {
    const existingLedgerEntries = await db.movementLedger.findMany({
      where: {
        matchRoundId,
        isDraft: true,
      },
      select: {
        playerId: true,
        matchId: true,
      },
    });

    const ledgerKeys = new Set(existingLedgerEntries.map((e) => `${e.playerId}:${e.matchId}`));

    for (const key of allNonCorePlayerKeys) {
      if (!ledgerKeys.has(key)) {
        const [playerId, matchId] = key.split(":");
        await db.warning.create({
          data: {
            matchRoundId,
            matchId,
            playerId,
            severity: WarningSeverity.WARNING,
            rule: "missing_movement_ledger",
            message: `Non-core selection for player ${playerId} in match ${matchId} has no movement ledger entry.`,
            resolved: false,
          },
        });
      }
    }
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