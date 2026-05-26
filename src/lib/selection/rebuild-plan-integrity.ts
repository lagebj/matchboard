import { db } from "@/lib/db";
import { computeRoundPlanIntegrity } from "./compute-plan-integrity";
import { replaceRoundActiveSignals } from "./reconcile-integrity";

export type RebuildResult = {
  dryRun: boolean;
  roundsProcessed: number;
  activeWarningRowsReplaced: number;
  currentBlockersCreatedOrRetained: number;
  currentDecisionsCreatedOrRetained: number;
  planningNotesDerived: number;
  skippedFinalizedRounds: number;
};

export async function rebuildPlanIntegrityForEditableRounds(options?: {
  dryRun?: boolean;
  matchRoundIds?: string[];
}): Promise<RebuildResult> {
  const dryRun = options?.dryRun ?? false;
  const targetIds = options?.matchRoundIds;

  const editableRounds = await db.matchRound.findMany({
    where: {
      status: "DRAFT",
      ...(targetIds ? { id: { in: targetIds } } : {}),
    },
    select: { id: true, name: true },
  });

  let activeWarningRowsReplaced = 0;
  let currentBlockersCreatedOrRetained = 0;
  let currentDecisionsCreatedOrRetained = 0;
  let planningNotesDerived = 0;

  for (const round of editableRounds) {
    const existingWarningCount = await db.warning.count({
      where: { matchRoundId: round.id },
    });

    const integrity = await computeRoundPlanIntegrity(round.id);

    currentBlockersCreatedOrRetained += integrity.summary.blockerCount;
    currentDecisionsCreatedOrRetained += integrity.summary.decisionRequiredCount;
    planningNotesDerived += integrity.planningNotes.length;

    if (!dryRun) {
      await replaceRoundActiveSignals(round.id, integrity);
    }

    activeWarningRowsReplaced += existingWarningCount;
  }

  return {
    dryRun,
    roundsProcessed: editableRounds.length,
    activeWarningRowsReplaced,
    currentBlockersCreatedOrRetained,
    currentDecisionsCreatedOrRetained,
    planningNotesDerived,
    skippedFinalizedRounds: 0,
  };
}