import { WarningSeverity, SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { formatOverrideReason, toPrismaCategory } from "@/lib/selection/override-reason-utils";

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
  overrideReasonCategory?: OverrideReasonCategory,
  overrideReasonDetail?: string,
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

  if (allOverrideWarnings.length > 0 && (!overrideReasonCategory)) {
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

  const hasHardOverrides = allOverrideWarnings.some(
    (w) => w.severity === WarningSeverity.HARD_BLOCK || w.severity === WarningSeverity.REQUIRES_OVERRIDE,
  );

  const formattedOverrideReason = overrideReasonCategory
    ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail)
    : null;

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

  const nonCoreDraftSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.DRAFT,
      role: { not: SelectionRole.CORE },
    },
    select: {
      playerId: true,
      matchId: true,
      role: true,
    },
  });

  const controlledDoubleLoadSelections = await db.selection.findMany({
    where: {
      matchId,
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
        matchId,
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
        const [playerId, mId] = key.split(":");
        await db.warning.create({
          data: {
            matchRoundId: match.matchRoundId,
            matchId: mId,
            playerId,
            severity: WarningSeverity.WARNING,
            rule: "missing_movement_ledger",
            message: `Non-core selection for player ${playerId} in match ${mId} has no movement ledger entry.`,
            resolved: false,
          },
        });
      }
    }
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
        overrideReason: hasHardOverrides ? formattedOverrideReason : null,
        overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : null,
        overrideReasonDetail: overrideReasonDetail ?? null,
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