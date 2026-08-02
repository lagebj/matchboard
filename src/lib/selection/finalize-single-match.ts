import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
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
    select: {
      id: true,
      matchRoundId: true,
      status: true,
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

  if (match.status === "CANCELLED") {
    return {
      success: false,
      warnings: ["Cancelled matches cannot be finalised. Reopen the match first."],
      hardBlocked: true,
      needsOverride: false,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const matchRound = await db.matchRound.findUnique({
    where: { id: match.matchRoundId },
    select: { id: true, status: true },
  });

  if (matchRound?.status === "FINALIZED") {
    return {
      success: false,
      warnings: ["This match is already in a finalised round."],
      hardBlocked: true,
      needsOverride: false,
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const integrity = await computeRoundPlanIntegrity(match.matchRoundId);

  const matchSignals = integrity.signals.filter(
    (s) => !s.matchId || s.matchId === matchId,
  );

  const blockedSignals = matchSignals.filter((s) => s.kind === "BLOCKED");
  const decisionRequiredSignals = matchSignals.filter((s) => s.kind === "DECISION_REQUIRED");

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
      finalizedSelectionCount: 0,
      matchId,
      roundAutoFinalized: false,
    };
  }

  const hasHardOverrides = allOverrideSignals.length > 0;

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

  const matchPlanningNotes = integrity.planningNotes.filter(
    (n) => !n.matchId || n.matchId === matchId,
  );

  const allWarningMessages = allOverrideSignals.map((s) => {
    return `[${s.kind}] ${s.ruleCode}: ${s.title}`;
  });

  const planningNoteMessages = matchPlanningNotes.map((n) => {
    return `[PLANNING_NOTE] ${n.code}: ${n.title}`;
  });

  return {
    success: true,
    warnings: [...allWarningMessages, ...planningNoteMessages],
    hardBlocked: false,
    needsOverride: false,
    finalizedSelectionCount: draftSelections.length,
    matchId,
    roundAutoFinalized,
  };
}