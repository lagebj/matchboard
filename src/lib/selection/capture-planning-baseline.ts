import { db } from "@/lib/db";
import { getRules } from "@/lib/rules/get-rules";
import { finalizeSelectionsForScope, finalizeRoundRecord, unfinalizeSelectionsForScope, unfinalizeRoundRecord } from "@/lib/selection/round-finalization-transitions";

/**
 * The one owner of "the pre-match plan has become historical intent" (ADR-0109, replacing
 * coach-operated finalize/un-finalize). It reuses `round-finalization-transitions.ts`'s existing
 * atomic writers unchanged — only the trigger moves, from a coach clicking "Finalize" to the
 * real-world planning boundary closing (live activity starting, or scheduled kickoff passing).
 */

export type PlanningBaselineCaptureResult = {
  /** True only when THIS call performed the capture. */
  captured: boolean;
  /** True when the baseline was already captured, by this call or an earlier one. */
  alreadyCaptured: boolean;
};

/**
 * Idempotent and safe under concurrent callers (Migration Rule #6): the `updateMany` with
 * `planningClosedAt: null` in its `where` clause atomically claims the capture, so a race between
 * a live-session start and a lazy read-path check never produces two contradictory baselines —
 * the loser sees `claim.count === 0` and safely no-ops.
 *
 * Re-derives the boundary condition itself (live active or kickoff passed) rather than trusting
 * the caller, so a bug in a call site can never trigger a premature capture — the one exception is
 * `force: true`, used only by live-session start, which is always a valid immediate-close trigger
 * regardless of scheduled kickoff (D4: "starting actual live activity must capture... the planned
 * baseline immediately").
 */
export async function ensureMatchPlanningBaselineCaptured(
  matchId: string,
  options?: { now?: Date; force?: boolean },
): Promise<PlanningBaselineCaptureResult> {
  const now = options?.now ?? new Date();

  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      matchRoundId: true,
      organisationId: true,
      status: true,
      planningClosedAt: true,
      startsAt: true,
      liveSession: { select: { status: true } },
    },
  });

  if (!match || match.status === "CANCELLED") {
    return { captured: false, alreadyCaptured: false };
  }

  if (match.planningClosedAt) {
    return { captured: false, alreadyCaptured: true };
  }

  const liveActive = match.liveSession?.status === "ACTIVE";
  const kickoffPassed = match.startsAt != null && new Date(match.startsAt) <= now;

  if (!options?.force && !liveActive && !kickoffPassed) {
    // The boundary genuinely has not closed yet — nothing to capture.
    return { captured: false, alreadyCaptured: false };
  }

  const claim = await db.match.updateMany({
    where: { id: matchId, planningClosedAt: null },
    data: { planningClosedAt: now },
  });

  if (claim.count === 0) {
    // Another concurrent caller already captured it.
    return { captured: false, alreadyCaptured: true };
  }

  // Explicit org scoping (not the zero-arg call the removed manual-finalize actions used):
  // this can now fire for any organisation, including one whose RuleConfig has never been
  // created yet, so `getRules()` needs an organisationId to fall back to creating one.
  const rules = await getRules({
    type: "org",
    organisationId: match.organisationId,
    filter: { organisationId: match.organisationId },
    filterNullable: { organisationId: match.organisationId },
  });
  const currentRuleConfigVersion = rules.version;
  const matchRoundId = match.matchRoundId;

  await db.$transaction(async (tx) => {
    // No override reason: this is an automatic, time-driven capture, not a coach decision.
    // Whatever plan exists at the boundary becomes the historical baseline, imperfect or not —
    // plan-integrity signals remain visible as attention items, they never block the boundary
    // from closing (PRINCIPLES.md #15/#17, PROGRAMME.md B3).
    await finalizeSelectionsForScope(tx, { matchId }, currentRuleConfigVersion, undefined, null, undefined, false);

    const remainingOpen = await tx.match.count({
      where: { matchRoundId, status: { not: "CANCELLED" }, planningClosedAt: null },
    });

    if (remainingOpen === 0) {
      const matchRound = await tx.matchRound.findFirst({
        where: { id: matchRoundId },
        select: { status: true },
      });
      if (matchRound && matchRound.status !== "FINALIZED") {
        await finalizeRoundRecord(tx, matchRoundId, rules.id, currentRuleConfigVersion);
      }
    }
  });

  return { captured: true, alreadyCaptured: false };
}

export type ReschedulePlanningReopenResult =
  | { reopened: true }
  | { reopened: false; reason: string };

/**
 * A genuine reschedule that proves the match did not start (ADR-0109 §4, PRINCIPLES.md #17:
 * "corrections change facts, not ceremony"). Reopens planning only when no actual match evidence
 * makes that unsafe. This is not "un-finalize" — it is called from the match reschedule command
 * when the new `startsAt` moves the match back into the future.
 */
export async function reopenMatchPlanningForReschedule(matchId: string): Promise<ReschedulePlanningReopenResult> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      matchRoundId: true,
      status: true,
      planningClosedAt: true,
      liveSession: { select: { id: true, status: true } },
    },
  });

  if (!match) {
    return { reopened: false, reason: "Match not found." };
  }

  if (!match.planningClosedAt) {
    // Planning was never closed — nothing to reopen.
    return { reopened: true };
  }

  if (match.liveSession) {
    return { reopened: false, reason: "This match has live match activity recorded. Correct the schedule without reopening the plan, or use post-match reconciliation." };
  }

  const report = await db.postMatchReport.findUnique({
    where: { matchId },
    select: { status: true, completedAt: true },
  });

  if (report && report.completedAt) {
    return { reopened: false, reason: "This match has a completed post-match report. The plan cannot be reopened — use post-match reconciliation instead." };
  }

  await db.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { planningClosedAt: null } });
    await unfinalizeSelectionsForScope(tx, { matchId });

    const matchRound = await tx.matchRound.findFirst({ where: { id: match.matchRoundId }, select: { status: true } });
    if (matchRound?.status === "FINALIZED") {
      await unfinalizeRoundRecord(tx, match.matchRoundId);
    }
  });

  return { reopened: true };
}
