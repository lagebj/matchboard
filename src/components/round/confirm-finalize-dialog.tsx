"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { OverrideReasonInput } from "@/components/round/override-reason-input";

type WarningSummary = {
  severity: string;
  message: string;
  rule: string;
};

type ConfirmFinalizeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (overrideReasonCategory: string, overrideReasonDetail: string) => void;
  blockingWarningCount: number;
  requiresOverrideCount: number;
  totalWarnings: number;
  selectedCount: number;
  targetSquadSize: number;
  matchCount: number;
  warnings?: WarningSummary[];
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
  warnings = [],
}: ConfirmFinalizeDialogProps) {
  const [overrideReason, setOverrideReason] = useState({ category: "", detail: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const hasIssues = blockingWarningCount > 0 || requiresOverrideCount > 0;
  const needsOverride = hasIssues;
  const categoryValid = !needsOverride || overrideReason.category !== "";
  const detailValid = !needsOverride || overrideReason.detail.trim().length >= 10;
  const overrideValid = !needsOverride || (categoryValid && detailValid);

  const handleConfirm = () => {
    if (!overrideValid) return;
    setIsSubmitting(true);
    onConfirm(overrideReason.category, overrideReason.detail.trim());
  };

  const blockedConditions = warnings.filter((w) => w.severity === "HARD_BLOCK");
  const decisionRequiredConditions = warnings.filter((w) => w.severity === "REQUIRES_OVERRIDE");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4 shrink-0">
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

        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
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
                  {totalWarnings} {totalWarnings === 1 ? "issue" : "issues"} need attention
                </span>
              </div>

              {blockingWarningCount > 0 && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="blocking" />
                    <span className="text-sm text-red-300">
                      {blockingWarningCount} Blocked {blockingWarningCount === 1 ? "condition" : "conditions"} — override reason required to finalize
                    </span>
                  </div>
                  {blockedConditions.length > 0 && (
                    <ul className="mt-1.5 ml-5 list-disc text-xs text-red-400/80 space-y-0.5">
                      {blockedConditions.map((w, i) => (
                        <li key={i}>{w.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {requiresOverrideCount > 0 && (
                <div className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="high" />
                    <span className="text-sm text-amber-300">
                      {requiresOverrideCount} {requiresOverrideCount === 1 ? "decision requires" : "decisions require"} override reason
                    </span>
                  </div>
                  {decisionRequiredConditions.length > 0 && (
                    <ul className="mt-1.5 ml-5 list-disc text-xs text-amber-400/80 space-y-0.5">
                      {decisionRequiredConditions.map((w, i) => (
                        <li key={i}>{w.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <OverrideReasonInput
            hasBlockingWarnings={needsOverride}
            value={overrideReason}
            onChange={setOverrideReason}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3 shrink-0">
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