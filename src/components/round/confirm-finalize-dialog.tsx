"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";

type ConfirmFinalizeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (overrideReason: string) => void;
  blockingWarningCount: number;
  requiresOverrideCount: number;
  totalWarnings: number;
  selectedCount: number;
  targetSquadSize: number;
  matchCount: number;
};

export function ConfirmFinalizeDialog({
  isOpen,
  onClose,
  onConfirm,
  blockingWarningCount,
  requiresOverrideCount,
  totalWarnings,
  selectedCount,
  targetSquadSize,
  matchCount,
}: ConfirmFinalizeDialogProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const hasWarnings = blockingWarningCount > 0 || requiresOverrideCount > 0;
  const needsOverride = hasWarnings;
  const overrideValid = !needsOverride || overrideReason.trim().length >= 10;

  const handleConfirm = () => {
    if (!overrideValid) return;
    setIsSubmitting(true);
    onConfirm(overrideReason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-100">
            Finalize round
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-sm text-zinc-200">
              <span className="font-semibold">{selectedCount}</span> players selected across{" "}
              <span className="font-semibold">{matchCount}</span> match{matchCount !== 1 ? "es" : ""},
              targeting <span className="font-semibold">{targetSquadSize}</span> squad size.
            </p>
          </div>

          {totalWarnings > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-200">
                  {totalWarnings} {totalWarnings === 1 ? "warning" : "warnings"}
                </span>
              </div>

              {blockingWarningCount > 0 && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="blocking" />
                    <span className="text-sm text-red-300">
                      {blockingWarningCount} blocking {blockingWarningCount === 1 ? "issue" : "issues"} — override reason required to finalize
                    </span>
                  </div>
                </div>
              )}

              {requiresOverrideCount > 0 && (
                <div className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="high" />
                    <span className="text-sm text-amber-300">
                      {requiresOverrideCount} {requiresOverrideCount === 1 ? "issue requires" : "issues require"} override reason
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {needsOverride && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-200" htmlFor="override-reason">
                Override reason
              </label>
              <textarea
                id="override-reason"
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
                rows={3}
                placeholder="Explain why these issues are being overridden (min 10 characters)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
              {overrideReason.length > 0 && overrideReason.trim().length < 10 && (
                <p className="text-xs text-amber-300">
                  Override reason must be at least 10 characters.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
          <button
            className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={!overrideValid || isSubmitting}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Finalizing..." : "Finalize round"}
          </button>
        </div>
      </div>
    </div>
  );
}