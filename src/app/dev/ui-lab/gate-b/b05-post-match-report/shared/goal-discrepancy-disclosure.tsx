"use client";

/**
 * R8-1 remediation — a B05-local, lifecycle-aware replacement for the real
 * `GoalAttributionGapBanner` (`src/components/matches/goal-attribution-gap-banner.tsx`), which
 * this candidate no longer renders. The real production component is left byte-for-byte
 * unmodified by this PR (out of scope — see BLOCKERS.md); this is a disclosed, candidate-only
 * proposed correction, not a claim that production already does this.
 *
 * Two real defects in reusing the production component's own fixed wording here:
 *
 * 1. Its instruction ("Add the missing scorer... before completing this report") is invalid once
 *    the report is already `LOCKED` — there is nothing left "before completing" at that point;
 *    the coach must reopen the report first.
 * 2. Its "missing scorer attribution" framing describes an existing Goal row with an unknown
 *    scorer. The real `computeGoalAttributionGap()` (`src/lib/reports/report-mutations.ts`)
 *    counts report Goal ROWS (`db.goal.count()`), never filtered by scorer presence — in this
 *    fixture's own scenario the discrepancy is a genuinely MISSING report Goal row, not an
 *    existing row with an unknown scorer. "Goal records" is the terminology that matches what is
 *    actually being counted.
 *
 * Renders nothing when there is no gap, matching the real component's own contract.
 */

type GoalDiscrepancyDisclosureProps = {
  gap: { liveGoalsRecorded: number; attributedGoals: number; hasGap: boolean } | null;
  isLocked: boolean;
};

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function GoalDiscrepancyDisclosure({ gap, isLocked }: GoalDiscrepancyDisclosureProps) {
  if (!gap || !gap.hasGap) return null;

  const { liveGoalsRecorded, attributedGoals } = gap;
  const missing = liveGoalsRecorded - attributedGoals;

  const message = isLocked
    ? `This completed report is missing ${missing} ${plural(missing, "goal", "goals")} recorded during Live Reporting. Reopen the report to add the missing ${plural(missing, "goal", "goals")}.`
    : `${liveGoalsRecorded} ${plural(liveGoalsRecorded, "goal was", "goals were")} recorded during Live Reporting, but this report contains only ${attributedGoals} goal ${plural(attributedGoals, "record", "records")}. Add the missing ${plural(missing, "goal", "goals")} to reconcile the report.`;

  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--foreground)]"
    >
      <p>{message}</p>
    </div>
  );
}
