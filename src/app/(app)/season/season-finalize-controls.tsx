"use client";

import { useState, useTransition, useEffect } from "react";
import { finalizeLeagueSeasonAction, unfinalizeLeagueSeasonAction, getFinalizationValidationAction } from "./season-actions";

type SeasonFinalizeControlsProps = {
  leagueSeasonId: string;
  leagueSeasonName: string;
  status: string;
  finalizedAt: Date | null;
  finalizedBy?: string | null;
};

export function SeasonFinalizeControls({
  leagueSeasonId,
  leagueSeasonName,
  status,
  finalizedAt,
  finalizedBy,
}: SeasonFinalizeControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentFinalizedAt, setCurrentFinalizedAt] = useState<Date | null>(finalizedAt ?? null);
  const [validation, setValidation] = useState<{
    canFinalize: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const isFinalized = currentStatus === "FINALIZED";

  useEffect(() => {
    if (!isFinalized) {
      startTransition(async () => {
        const result = await getFinalizationValidationAction(leagueSeasonId);
        setValidation(result.validation);
      });
    }
  }, [leagueSeasonId, isFinalized]);

  const handleFinalize = () => {
    if (!validation?.canFinalize) {
      setShowValidation(true);
      return;
    }
    const hasWarnings = validation.warnings.length > 0;
    const confirmMsg = hasWarnings
      ? `Finalize ${leagueSeasonName}?\n\nWarnings:\n${validation.warnings.map((w) => `- ${w}`).join("\n")}\n\nThis will create a snapshot of team rosters. The league season will be locked from further planning changes.`
      : `Finalize ${leagueSeasonName}? This will create a snapshot of team rosters. The league season will be locked from further planning changes.`;
    if (!confirm(confirmMsg)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await finalizeLeagueSeasonAction(leagueSeasonId);
      if (result.success) {
        setCurrentStatus("FINALIZED");
        setCurrentFinalizedAt(new Date());
        setValidation(null);
        setShowValidation(false);
      } else {
        setError(result.error ?? result.validation?.errors?.join("; ") ?? "Failed to finalise.");
        if (result.validation) {
          setValidation(result.validation);
          setShowValidation(true);
        }
      }
    });
  };

  const handleUnfinalize = () => {
    if (!confirm(`Unfinalise ${leagueSeasonName}? The snapshot will be deleted, and the league season will be reopened for planning. You can re-finalise later, which will create a new snapshot.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await unfinalizeLeagueSeasonAction(leagueSeasonId);
      if (result.success) {
        setCurrentStatus("OPEN");
        setCurrentFinalizedAt(null);
      } else {
        setError(result.error ?? "Failed to unfinalise.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {isFinalized ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-950/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Finalised
              {currentFinalizedAt && (
                <span className="text-emerald-400/60">
                  {new Date(currentFinalizedAt).toLocaleDateString()}
                </span>
              )}
              {finalizedBy && (
                <span className="text-emerald-400/40" title={`Finalised by: ${finalizedBy}`}>
                  by {finalizedBy}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleUnfinalize}
              disabled={isPending}
              className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors disabled:opacity-50"
            >
              Unfinalise
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isPending}
            className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-medium text-zinc-100 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
          >
            Finalise league season
          </button>
        )}
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
      {showValidation && validation && !isFinalized && (
        <div className="flex flex-col gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
          {validation.errors.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {validation.errors.map((err, i) => (
                <span key={i} className="text-red-400">{err}</span>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {validation.warnings.map((w, i) => (
                <span key={i} className="text-amber-400">{w}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}