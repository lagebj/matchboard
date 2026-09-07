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
 * Freezes each relevant player's current availability into round-scoped `Availability` rows as
 * the round's planning boundary closes (ADR-0121, resolving the historical half of ARR-0041).
 * This is the ONE production writer of the `Availability` model: historical readers
 * (`compute-plan-integrity.ts`'s availability checks and its `repeatedContext` enrichment,
 * `get-planning-period-fairness.ts`'s "unavailable rounds excluded from fairness debt", and the
 * Insights `opportunity-*`/`load-timeline` readers) have always queried this model but, with no
 * writer, every real finalized round resolved to "no row" and the historical availability
 * question was silently unanswerable.
 *
 * Population: players with a selection in the round, plus active players whose core team has a
 * non-cancelled match in it — the same population `computeRoundPlanIntegrity()`'s
 * missing-opportunity check evaluates, so a queried player with no captured row genuinely had no
 * round obligation (a player whose core team was not playing is not "unknown", they were simply
 * out of scope).
 *
 * Idempotent (`skipDuplicates`) and immutable once written — the value is frozen at boundary
 * close and a later edit to `Player.currentAvailability` (for a future round) never rewrites it.
 * Cleared by `clearRoundAvailabilitySnapshot()` only on a genuine reschedule-reopen.
 */
async function captureRoundAvailabilitySnapshot(
  tx: TransactionClient,
  matchRoundId: string,
): Promise<void> {
  const playableTeamIds = (
    await tx.match.findMany({
      where: { matchRoundId, status: { not: "CANCELLED" } },
      select: { teamId: true },
    })
  ).map((m) => m.teamId);

  const selectedPlayerIds = (
    await tx.selection.findMany({
      where: { matchRoundId },
      select: { playerId: true },
      distinct: ["playerId"],
    })
  ).map((s) => s.playerId);

  if (playableTeamIds.length === 0 && selectedPlayerIds.length === 0) return;

  const players = await tx.player.findMany({
    where: {
      removedAt: null,
      OR: [
        playableTeamIds.length > 0 ? { coreTeamId: { in: playableTeamIds } } : undefined,
        selectedPlayerIds.length > 0 ? { id: { in: selectedPlayerIds } } : undefined,
      ].filter((c): c is NonNullable<typeof c> => c != null),
    },
    select: { id: true, currentAvailability: true, organisationId: true },
  });

  if (players.length === 0) return;

  await tx.availability.createMany({
    data: players.map((p) => ({
      playerId: p.id,
      matchRoundId,
      status: p.currentAvailability,
      organisationId: p.organisationId,
    })),
    skipDuplicates: true,
  });
}

/** Reverse of `captureRoundAvailabilitySnapshot()` — used only when a genuine reschedule reopens
 * a round's planning (`reopenMatchPlanningForReschedule()`). The round becomes DRAFT again and
 * its availability is live-editable, so the frozen snapshot must not linger and must not make the
 * reopened round read as "captured" (ADR-0121). Safe because this snapshot is the only writer of
 * `Availability` rows for a League round. */
async function clearRoundAvailabilitySnapshot(
  client: TransactionClient | typeof db,
  matchRoundId: string,
): Promise<void> {
  await client.availability.deleteMany({ where: { matchRoundId } });
}

/**
 * The literal "this round record becomes FINALIZED" write, plus the rule-config version bump
 * that always accompanies it, plus the availability snapshot (ADR-0121). Round-level finalize
 * calls this unconditionally after finalizing its selections; per-match finalize calls it only
 * when the match it just finalized was the round's last remaining DRAFT match (auto-finalizing
 * the round as a side effect).
 */
export async function finalizeRoundRecord(
  tx: TransactionClient,
  matchRoundId: string,
  rulesId: string,
  currentRuleConfigVersion: number,
): Promise<void> {
  await captureRoundAvailabilitySnapshot(tx, matchRoundId);

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
  await clearRoundAvailabilitySnapshot(client, matchRoundId);

  await client.matchRound.update({
    where: { id: matchRoundId },
    data: { status: "DRAFT" },
  });
}
