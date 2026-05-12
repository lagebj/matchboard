"use client";

import { useState, useTransition } from "react";
import type { DecisionType, AssistantIssueEntityType, DecisionAction } from "@/domain/assistant-manager/types";
import { createDecision } from "@/domain/assistant-manager/actions";

type DecisionPanelProps = {
  decisionType: DecisionType;
  entityType: AssistantIssueEntityType;
  entityId: string;
  action: DecisionAction;
  actionLabel: string;
  reasonRequired: boolean;
  recommendationId?: string;
};

export function DecisionPanel({ decisionType, entityType, entityId, action, actionLabel, reasonRequired, recommendationId }: DecisionPanelProps) {
  const [reason, setReason] = useState("");
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAction = (providedReason?: string) => {
    startTransition(async () => {
      await createDecision({
        decisionType,
        entityType,
        entityId,
        recommendationId,
        action,
        reason: providedReason,
      });
    });
  };

  if (!reasonRequired) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction()}
        className="h-7 rounded border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-3 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
      >
        {isPending ? "Processing..." : actionLabel}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowReasonModal(true)}
        disabled={isPending}
        className="h-7 rounded border border-zinc-700/40 bg-zinc-800/30 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-700/30 disabled:opacity-50"
      >
        {actionLabel}
      </button>
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReasonModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">{actionLabel}</h3>
              <p className="text-sm text-zinc-300">A reason is required for this decision.</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason..."
                className="rounded-md border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                rows={3}
              />
              {!reason.trim() && (
                <p className="text-xs text-red-400">A reason is required for this decision.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => {
                  handleAction(reason.trim());
                  setShowReasonModal(false);
                  setReason("");
                }}
                className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] disabled:opacity-50"
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}