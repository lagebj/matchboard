"use client";

import { useState, useTransition } from "react";
import { TouchlineButton } from "@/components/touchline";
import { updateMatchFormatOverrideAction } from "@/app/(app)/matches/actions";

type MatchFormat = {
  numberOfPeriods: number;
  periodDurationMinutes: number;
  breakDurationMinutes: number;
};

type MatchFormatOverrideControlsProps = {
  matchId: string;
  /** The match's own complete override, or null (inherit). */
  matchOverride: MatchFormat | null;
  /** What the match inherits from Team/Season when no override is set (may itself be null —
   * "Not configured" — for a legacy/unconfigured season and team). */
  inheritedFormat: MatchFormat | null;
  /** Once Live Reporting has started, the frozen snapshot is authoritative and this control
   * becomes a read-only display of it (bundle §05.4: never present pre-live override controls
   * as though they could change the current live timing model). */
  liveReportingStarted: boolean;
  frozenFormat: MatchFormat | null;
};

function formatLabel(format: MatchFormat): string {
  return `${format.numberOfPeriods} × ${format.periodDurationMinutes} min, ${format.breakDurationMinutes} min break`;
}

/**
 * Match-specific match-format override (ADR-0146 §1, bundle §05.4). Complete-or-inherit, never
 * partial (the action rejects a partial write; the UI only ever submits all three fields).
 * Highest precedence over Team/LeagueSeason, editable only before Live Reporting starts.
 */
export function MatchFormatOverrideControls({
  matchId,
  matchOverride,
  inheritedFormat,
  liveReportingStarted,
  frozenFormat,
}: MatchFormatOverrideControlsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<MatchFormat>(
    matchOverride ?? inheritedFormat ?? { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
  );
  const [savedOverride, setSavedOverride] = useState<MatchFormat | null>(matchOverride);

  function handleSave(useOverride: boolean) {
    setError(null);
    const format = useOverride ? current : null;
    startTransition(async () => {
      const result = await updateMatchFormatOverrideAction(matchId, format);
      if (result.success) {
        setSavedOverride(result.format);
        setIsEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (liveReportingStarted) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-[var(--text-soft)]">Match format:</span>
        <span className="text-[var(--text-muted)]">
          {frozenFormat ? formatLabel(frozenFormat) : "Not configured (legacy live session)"}
        </span>
        <span className="text-[var(--text-muted)]">Frozen for this live match</span>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-[var(--text-soft)]">Match format:</span>
        {savedOverride ? (
          <span className="text-[var(--text-muted)]">{formatLabel(savedOverride)} (match-specific)</span>
        ) : inheritedFormat ? (
          <span className="text-[var(--text-muted)]">{formatLabel(inheritedFormat)} (inherited)</span>
        ) : (
          <span className="text-[var(--warning)]">Not configured</span>
        )}
        <TouchlineButton type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </TouchlineButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)]">Periods</label>
          <select
            value={current.numberOfPeriods}
            onChange={(e) => setCurrent({ ...current, numberOfPeriods: parseInt(e.target.value, 10) })}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1.5 text-xs"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)]">Period length (min)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={current.periodDurationMinutes}
            onChange={(e) => setCurrent({ ...current, periodDurationMinutes: parseInt(e.target.value, 10) || 0 })}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)]">Break length (min)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={current.breakDurationMinutes}
            onChange={(e) => setCurrent({ ...current, breakDurationMinutes: parseInt(e.target.value, 10) || 0 })}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1.5 text-xs"
          />
        </div>
      </div>
      {inheritedFormat && (
        <span className="text-[10px] text-[var(--text-muted)]">
          Inherited otherwise: {formatLabel(inheritedFormat)}
        </span>
      )}
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      <div className="flex flex-wrap gap-2">
        <TouchlineButton type="button" variant="primary" size="sm" onClick={() => handleSave(true)} disabled={isPending}>
          Use this match format
        </TouchlineButton>
        {savedOverride && (
          <TouchlineButton type="button" variant="ghost" size="sm" onClick={() => handleSave(false)} disabled={isPending}>
            Use inherited format
          </TouchlineButton>
        )}
        <TouchlineButton type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isPending}>
          Cancel
        </TouchlineButton>
      </div>
    </div>
  );
}