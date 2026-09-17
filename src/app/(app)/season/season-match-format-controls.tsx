"use client";

import { useState, useTransition } from "react";
import { TouchlineButton } from "@/components/touchline";
import { updateLeagueSeasonMatchFormatAction } from "./season-actions";

type SeasonMatchFormatControlsProps = {
  leagueSeasonId: string;
  numberOfPeriods: number | null;
  periodDurationMinutes: number | null;
  breakDurationMinutes: number | null;
};

/**
 * League Season match-format settings (ADR-0146). A legacy/unconfigured season shows an
 * explicit "Not configured" state — never a silently-guessed default (bundle §05.2). Configuring
 * or changing this here only affects matches that have not yet frozen their effective format at
 * Live Reporting start; it never reinterprets an already-live or completed match.
 */
export function SeasonMatchFormatControls({
  leagueSeasonId,
  numberOfPeriods,
  periodDurationMinutes,
  breakDurationMinutes,
}: SeasonMatchFormatControlsProps) {
  const isConfigured = numberOfPeriods != null && periodDurationMinutes != null && breakDurationMinutes != null;
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState({
    numberOfPeriods: numberOfPeriods ?? 2,
    periodDurationMinutes: periodDurationMinutes ?? 25,
    breakDurationMinutes: breakDurationMinutes ?? 10,
  });
  const [savedConfigured, setSavedConfigured] = useState(isConfigured);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateLeagueSeasonMatchFormatAction(leagueSeasonId, current);
      if (result.success) {
        setSavedConfigured(true);
        setIsEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-[var(--text-soft)]">Match format:</span>
        {savedConfigured ? (
          <span className="text-[var(--text-muted)]">
            {current.numberOfPeriods} × {current.periodDurationMinutes} min, {current.breakDurationMinutes} min break
          </span>
        ) : (
          <span className="text-[var(--warning)]">Not configured</span>
        )}
        <TouchlineButton type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          {savedConfigured ? "Edit" : "Configure"}
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
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      <div className="flex gap-2">
        <TouchlineButton type="button" variant="primary" size="sm" onClick={handleSave} disabled={isPending}>
          Save
        </TouchlineButton>
        <TouchlineButton type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isPending}>
          Cancel
        </TouchlineButton>
      </div>
    </div>
  );
}
