import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { toPrismaCategory } from "@/lib/selection/override-reason-utils";

/**
 * Owning writes for the Plan-phase FINALIZE/UN-FINALIZE transition (ADR-0088, ARR-0028).
 *
 * `finalize-match-round.ts` (round-level) and `finalize-single-match.ts` (per-match) are
 * distinct product operations at different granularity — not duplicates of each other — but
 * both must persist an identical field set when a set of selections becomes FINALIZED, and an
 * identical field set when a round record itself becomes FINALIZED. Likewise for
 * `unfinalize-match-round.ts`/`unfinalize-single-match.ts` reverting to DRAFT. This module is
 * the one place those field sets are decided; the four callers orchestrate validation,
 * plan-integrity checks, and response shape around a call to these functions instead of
 * reimplementing the writes.
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
