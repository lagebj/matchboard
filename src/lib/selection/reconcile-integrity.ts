import { db } from "@/lib/db";
import { computeRoundPlanIntegrity, type RoundPlanIntegrity } from "./compute-plan-integrity";
import { reconcileAssistantWorkItemsForRound } from "./reconcile-assistant-work";
import { WarningSeverity } from "@/generated/prisma/client";

const SIGNAL_KIND_TO_DB_SEVERITY: Record<string, WarningSeverity> = {
  BLOCKED: WarningSeverity.HARD_BLOCK,
  DECISION_REQUIRED: WarningSeverity.REQUIRES_OVERRIDE,
};

export async function replaceRoundActiveSignals(
  matchRoundId: string,
  integrity: RoundPlanIntegrity,
): Promise<void> {
  const warnings = integrity.signals.map((s) => ({
    matchRoundId,
    matchId: s.matchId ?? null,
    playerId: s.playerId ?? null,
    teamId: s.teamId ?? null,
    severity: SIGNAL_KIND_TO_DB_SEVERITY[s.kind] ?? WarningSeverity.WARNING,
    rule: s.ruleCode,
    message: s.title,
    resolved: false,
  }));

  await db.$transaction(async (tx) => {
    await tx.warning.deleteMany({
      where: { matchRoundId },
    });

    if (warnings.length > 0) {
      for (const w of warnings) {
        await tx.warning.create({ data: w });
      }
    }
  });
}

export async function reconcileRoundAfterDraftMutation(
  matchRoundId: string,
): Promise<RoundPlanIntegrity> {
  const integrity = await computeRoundPlanIntegrity(matchRoundId);

  await replaceRoundActiveSignals(matchRoundId, integrity);

  const blockedCount = integrity.summary.blockerCount;

  const roundHasFinalized = await db.selection.findFirst({
    where: { matchRoundId, status: "FINALIZED" },
    select: { id: true },
  });

  if (!roundHasFinalized) {
    const hasDraftSelections = await db.selection.findFirst({
      where: { matchRoundId, status: "DRAFT" },
      select: { id: true },
    });

    if (blockedCount > 0) {
      await db.matchRound.update({
        where: { id: matchRoundId },
        data: { status: "DRAFT" },
      });
    } else if (hasDraftSelections) {
      await db.matchRound.update({
        where: { id: matchRoundId },
        data: { status: "DRAFT" },
      });
    }
  }

  try {
    await reconcileAssistantWorkItemsForRound(integrity);
  } catch {
    // assistant reconciliation failure must not block the mutation
  }

  return integrity;
}