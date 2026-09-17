"use client";

/**
 * 2026-09-17 incident follow-up — a report-review-time signal for the exact failure mode a
 * persistence bug produced that day: every `SCORER_SET` was silently rejected, leaving a report
 * with a correct score (from `GOAL_FOR`/`GOAL_AGAINST` events) but zero scorer attribution, and
 * nothing surfaced that until a coach happened to check by eye. `computeGoalAttributionGap()`
 * (`report-mutations.ts`) computes the comparison server-side, straight from the canonical event
 * stream — independent of the live-reporting outbox's own surfacing (`PostMatchUnresolvedBanner`,
 * `isActionableForCoach`), so a mismatch is still caught even if that device-local signal is
 * somehow missed (a different device finished the match, the outbox was cleared, etc.).
 *
 * Renders nothing when there is no gap (including when this match was never live-reported at
 * all — `gap` is `null` in that case, see `computeGoalAttributionGap`'s own doc comment).
 */

interface GoalAttributionGapBannerProps {
  gap: { liveGoalsRecorded: number; attributedGoals: number; hasGap: boolean } | null;
}

export function GoalAttributionGapBanner({ gap }: GoalAttributionGapBannerProps) {
  if (!gap || !gap.hasGap) return null;

  const missing = gap.liveGoalsRecorded - gap.attributedGoals;

  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--foreground)]"
    >
      <p>
        {gap.liveGoalsRecorded} goal{gap.liveGoalsRecorded > 1 ? "s were" : " was"} recorded during live reporting, but
        only {gap.attributedGoals} {gap.attributedGoals === 1 ? "has" : "have"} a scorer in this report — {missing}{" "}
        goal{missing > 1 ? "s" : ""} {missing > 1 ? "are" : "is"} missing scorer attribution. Add the missing scorer
        {missing > 1 ? "s" : ""} below before completing this report.
      </p>
    </div>
  );
}
