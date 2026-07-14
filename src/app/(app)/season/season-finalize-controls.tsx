"use client";

import { useState, useTransition } from "react";
import { finalizeLeagueSeasonAction, unfinalizeLeagueSeasonAction } from "./season-actions";

type SeasonFinalizeControlsProps = {
  leagueSeasonId: string;
  leagueSeasonName: string;
  status: string;
  finalizedAt: Date | null;
};

export function SeasonFinalizeControls({
  leagueSeasonId,
  leagueSeasonName,
  status,
  finalizedAt,
}: SeasonFinalizeControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentFinalizedAt, setCurrentFinalizedAt] = useState<Date | null>(finalizedAt);

  const isFinalized = currentStatus === "FINALIZED";

  const handleFinalize = () => {
    if (!confirm(`Finalize ${leagueSeasonName}? This will create a snapshot of team rosters. The league season will be locked from further planning changes.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await finalizeLeagueSeasonAction(leagueSeasonId);
      if (result.success) {
        setCurrentStatus("FINALIZED");
        setCurrentFinalizedAt(new Date());
      } else {
        setError(result.error ?? "Failed to finalize.");
      }
    });
  };

  const handleUnfinalize = () => {
    if (!confirm(`Unfinalize ${leagueSeasonName}? The snapshot will be preserved, but the league season will be reopened for planning.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await unfinalizeLeagueSeasonAction(leagueSeasonId);
      if (result.success) {
        setCurrentStatus("OPEN");
        setCurrentFinalizedAt(null);
      } else {
        setError(result.error ?? "Failed to unfinalize.");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      {isFinalized ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-950/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Finalized
            {currentFinalizedAt && (
              <span className="text-emerald-400/60">
                {new Date(currentFinalizedAt).toLocaleDateString()}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={handleUnfinalize}
            disabled={isPending}
            className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors disabled:opacity-50"
          >
            Unfinalize
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleFinalize}
          disabled={isPending}
          className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-medium text-zinc-100 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
        >
          Finalize league season
        </button>
      )}
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}