import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { toPrismaCategory } from "@/lib/selection/override-reason-utils";

/**
 * Owning writes for the planning-boundary-capture transition (ADR-0088, ARR-0028; trigger moved
 * from coach-operated finalize/un-finalize to the automatic boundary closure by ADR-0109).
 *
 * `capture-planning-baseline.ts`'s `ensureMatchPlanningBaselineCaptured()` (per-match capture,
 * with round-record capture as an automatic side effect when it was the round's last open match)
 * and `reopenMatchPlanningForReschedule()` (the reverse, for a genuine reschedule-before-start
 * correction) are the only two callers. This module is the one place the field sets they persist
 * are decided; those callers orchestrate the boundary condition and transaction shape around a
 * call to these functions instead of reimplementing the writes.
 */

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export type SelectionScope = { matchRoundId: string } | { matchId: string };

/**
 * Marks every DRAFT selection in `scope` as FINALIZED and stamps the override/rule-config
 * fields that go with it, then flips the matching MovementLedger entries out of draft. Must run
 * inside the caller's transaction.
 */
export async function finalizeSelectionsForScope(
  tx: TransactionClient,
  scope: SelectionScope,
  currentRuleConfigVersion: number,
  overrideReasonCategory: OverrideReasonCategory | undefined,
  formattedOverrideReason: string | null,
  overrideReasonDetail: string | undefined,
  hasHardOverrides: boolean,
): Promise<void> {
  await tx.selection.updateMany({
    where: { ...scope, status: SelectionStatus.DRAFT },
    data: {
      status: SelectionStatus.FINALIZED,
      ruleConfigVersion: currentRuleConfigVersion,
      overrideReason: hasHardOverrides ? formattedOverrideReason : null,
      overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : null,
      overrideReasonDetail: overrideReasonDetail ?? null,
    },
  });

  await tx.movementLedger.updateMany({
    where: { ...scope, isDraft: true },
    data: { isDraft: false },
  });
}

/**
 * Reverts every FINALIZED selection in `scope` back to DRAFT, clearing the override/rule-config
 * fields finalization stamped, then flips the matching MovementLedger entries back to draft.
 */
export async function unfinalizeSelectionsForScope(
  client: TransactionClient | typeof db,
  scope: SelectionScope,
): Promise<void> {
  await client.selection.updateMany({
    where: { ...scope, status: SelectionStatus.FINALIZED },
    data: {
      status: SelectionStatus.DRAFT,
      ruleConfigVersion: null,
      overrideReason: null,
      overrideReasonCategory: null,
      overrideReasonDetail: null,
    },
  });

  await client.movementLedger.updateMany({
    where: { ...scope, isDraft: false },
    data: { isDraft: true },
  });
}

/**
 * The literal "this round record becomes FINALIZED" write, plus the rule-config version bump
 * that always accompanies it. Round-level finalize calls this unconditionally after finalizing
 * its selections; per-match finalize calls it only when the match it just finalized was the
 * round's last remaining DRAFT match (auto-finalizing the round as a side effect).
 */
export async function finalizeRoundRecord(
  tx: TransactionClient,
  matchRoundId: string,
  rulesId: string,
  currentRuleConfigVersion: number,
): Promise<void> {
  await tx.matchRound.update({
    where: { id: matchRoundId },
    data: { status: "FINALIZED" },
  });

  await tx.ruleConfig.update({
    where: { id: rulesId },
    data: { version: currentRuleConfigVersion + 1 },
  });
}

/**
 * The literal "this round record reverts to DRAFT" write (ADR-0083: DRAFT and FINALIZED are the
 * only two values ever valid to persist — BLOCKED/READY/NOT_GENERATED are UI-derived display
 * states, never written here). Round-level un-finalize calls this unconditionally; per-match
 * un-finalize calls it only when no FINALIZED selections remain in the round.
 */
export async function unfinalizeRoundRecord(
  client: TransactionClient | typeof db,
  matchRoundId: string,
): Promise<void> {
  await client.matchRound.update({
    where: { id: matchRoundId },
    data: { status: "DRAFT" },
  });
}
