"use client";

import { useState } from "react";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TouchlineButton } from "@/components/touchline";
import type { PostMatchReportTimingReviewRow, ActionResult } from "@/lib/reports/post-match-report-view-model";

/**
 * ADR-0146 §8/§13/§14 — the post-match recovered-timing callout: `finishLiveReporting` (slice 3)
 * bounded a period that was still active when Live Reporting completed, and the coach must
 * explicitly confirm or correct that duration before the report can be completed (§15's
 * submission gate, enforced server-side in `completeReport`/`completeEventReport` — this is the
 * proactive, always-visible counterpart, not the only enforcement).
 *
 * Deliberately does not expose raw timestamps as the primary correction surface (§13) — only the
 * resolved minutes, confirm, and a single duration input for correction.
 */

interface RecoveredTimingCalloutProps {
  items: PostMatchReportTimingReviewRow[];
  outOfRangeEventCount?: number;
  onConfirm?: (period: string) => Promise<ActionResult>;
  onCorrect?: (period: string, correctedDurationMinutes: number) => Promise<ActionResult>;
  disabled?: boolean;
}

export function RecoveredTimingCallout({ items, outOfRangeEventCount, onConfirm, onCorrect, disabled }: RecoveredTimingCalloutProps) {
  const needsReview = items.filter((i) => i.needsReview);
  const hasOutOfRangeEvents = !!outOfRangeEventCount && outOfRangeEventCount > 0;
  // An out-of-range event can outlive its period's own review (e.g. a correction made in an
  // earlier session left a conflicting event uncorrected) -- show that notice on its own too,
  // not only alongside a currently-NEEDS_REVIEW period.
  if (needsReview.length === 0 && !hasOutOfRangeEvents) return null;

  return (
    <div className="flex flex-col gap-3">
      {needsReview.map((item) => (
        <TimingReviewItemBanner
          key={item.period}
          item={item}
          onConfirm={onConfirm}
          onCorrect={onCorrect}
          disabled={disabled}
        />
      ))}
      {hasOutOfRangeEvents && (
        <DecisionBanner
          variant="blocked"
          title={`${outOfRangeEventCount} recorded event${outOfRangeEventCount > 1 ? "s fall" : " falls"} outside a corrected period duration`}
          description="Correct the affected event(s) through the live-event editor before this report can be completed."
        />
      )}
    </div>
  );
}

function TimingReviewItemBanner({
  item,
  onConfirm,
  onCorrect,
  disabled,
}: {
  item: PostMatchReportTimingReviewRow;
  onConfirm?: (period: string) => Promise<ActionResult>;
  onCorrect?: (period: string, correctedDurationMinutes: number) => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(item.resolvedDurationMinutes));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!onConfirm) return;
    setPending(true);
    setError(null);
    const result = await onConfirm(item.period);
    setPending(false);
    if (!result.success) setError(result.error ?? "Failed to confirm timing.");
  }

  async function handleSaveCorrection() {
    if (!onCorrect) return;
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid duration in minutes.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onCorrect(item.period, parsed);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Failed to save the corrected duration.");
      return;
    }
    setEditing(false);
  }

  return (
    <DecisionBanner
      variant="decision"
      title={`${item.periodLabel} was still running when Live Reporting was completed`}
      description={
        <div className="flex flex-col gap-2">
          <p>
            Matchboard limited the automatically resolved period time to {item.resolvedDurationMinutes} minute
            {item.resolvedDurationMinutes === 1 ? "" : "s"}. Review the period timing before submitting the report.
          </p>
          {error && <p className="text-[var(--danger)]">{error}</p>}
        </div>
      }
      action={
        editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={pending || disabled}
              className="w-20 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              aria-label={`Corrected duration for ${item.periodLabel} (minutes)`}
            />
            <TouchlineButton variant="primary" size="sm" disabled={pending || disabled} onClick={handleSaveCorrection}>
              Save
            </TouchlineButton>
            <TouchlineButton variant="secondary" size="sm" disabled={pending || disabled} onClick={() => setEditing(false)}>
              Cancel
            </TouchlineButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <TouchlineButton variant="primary" size="sm" disabled={pending || disabled} onClick={handleConfirm}>
              Confirm duration
            </TouchlineButton>
            <TouchlineButton variant="secondary" size="sm" disabled={pending || disabled} onClick={() => setEditing(true)}>
              Edit duration
            </TouchlineButton>
          </div>
        )
      }
    />
  );
}
