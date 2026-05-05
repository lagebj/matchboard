import { WarningSeverity, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";

export type FinalizeSingleMatchResult = {
  success: boolean;
  warnings: string[];
  hardBlocked: boolean;
  needsOverride: boolean;
  finalizedSelectionCount: number;
  matchId: string;
  roundAutoFinalized: boolean;
};

export async function finalizeSingleMatch(
  matchId: string,
  overrideReason?: string,
): Promise<FinalizeSingleMatchResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      matchRound: {
        include: {
          matches: { select: { id: true } },
          warnings: {
            select: {
              id: true,
              severity: true,
              rule: true,
              message: true,
              resolved: true,
              matchId: true,
            },
          },
        },
      },
    },
  });

  if (!match) {
    return {
      success: false,
      warnings: ["Match not found."],
      hardBlocked: true,
      needsOverride: false,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  if (match.matchRound.status === "FINALIZED") {
    return {
      success: false,
      warnings: ["This match is already in a finalized round."],
      hardBlocked: true,
      needsOverride: false,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const matchWarnings = match.matchRound.warnings.filter(
    (w) => w.matchId === matchId && !w.resolved,
  );

  const hardBlockWarnings = matchWarnings.filter(
    (w) => w.severity === WarningSeverity.HARD_BLOCK,
  );

  const requiresOverrideWarnings = matchWarnings.filter(
    (w) => w.severity === WarningSeverity.REQUIRES_OVERRIDE,
  );

  const allOverrideWarnings = [...hardBlockWarnings, ...requiresOverrideWarnings];

  if (allOverrideWarnings.length > 0 && (!overrideReason || overrideReason.trim().length === 0)) {
    const overrideMessages = allOverrideWarnings.map(
      (w) => `[${w.severity as string}] ${w.rule}: ${w.message}`,
    );
    return {
      success: false,
      warnings: overrideMessages,
      hardBlocked: false,
      needsOverride: true,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const rules = await getRules();

  const draftSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.DRAFT,
    },
    select: { id: true },
  });

  if (draftSelections.length === 0) {
    return {
      success: false,
      warnings: ["No draft selections found for this match."],
      hardBlocked: false,
      needsOverride: false,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const currentRuleConfigVersion = rules.version;
  const matchRoundId = match.matchRoundId;

  let roundAutoFinalized = false;

  await db.$transaction(async (tx) => {
    await tx.selection.updateMany({
      where: {
        matchId,
        status: SelectionStatus.DRAFT,
      },
      data: {
        status: SelectionStatus.FINALIZED,
        ruleConfigVersion: currentRuleConfigVersion,
        overrideReason: allOverrideWarnings.length > 0 ? overrideReason ?? null : null,
      },
    });

    await tx.movementLedger.updateMany({
      where: {
        matchId,
        isDraft: true,
      },
      data: {
        isDraft: false,
      },
    });

    const remainingDraftSelections = await tx.selection.count({
      where: {
        matchRoundId,
        status: SelectionStatus.DRAFT,
      },
    });

    if (remainingDraftSelections === 0) {
      await tx.matchRound.update({
        where: { id: matchRoundId },
        data: { status: "FINALIZED" },
      });

      await tx.ruleConfig.update({
        where: { id: rules.id },
        data: { version: currentRuleConfigVersion + 1 },
      });

      roundAutoFinalized = true;
    }
  });

  const allWarningMessages = matchWarnings.map(
    (w) => `[${w.severity as string}] ${w.rule}: ${w.message}`,
  );

  return {
    success: true,
    warnings: allWarningMessages,
    hardBlocked: false,
    needsOverride: false,
    finalizedSelectionCount: draftSelections.length,
    matchId,
    roundAutoFinalized,
  };
}