"use client";

import { useState, useTransition } from "react";
import type { Recommendation, DecisionType, AssistantIssueEntityType } from "@/domain/assistant-manager/types";
import { createDecision } from "@/domain/assistant-manager/actions";

function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "HIGH": return "High confidence";
    case "MEDIUM": return "Medium confidence";
    case "LOW": return "Low confidence";
    default: return confidence;
  }
}

function confidenceClasses(confidence: string): string {
  switch (confidence) {
    case "HIGH": return "text-emerald-400";
    case "MEDIUM": return "text-amber-400";
    case "LOW": return "text-zinc-400";
    default: return "text-zinc-400";
  }
}

type RecommendationPanelProps = {
  recommendation: Recommendation;
  decisionType?: DecisionType;
  entityType?: AssistantIssueEntityType;
  entityId?: string;
};

export function RecommendationPanel({ recommendation, decisionType = "ASSISTANT_ISSUE", entityType = "ROUND", entityId = "" }: RecommendationPanelProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    startTransition(async () => {
      await createDecision({
        decisionType,
        entityType,
        entityId,
        recommendationId: recommendation.id,
        action: "ACCEPT_RECOMMENDATION",
      });
    });
  };

  return (
    <div className="rounded-md border border-emerald-700/30 bg-emerald-900/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Recommendation</p>
        <span className={`text-[10px] font-medium ${confidenceClasses(recommendation.confidence)}`}>
          {confidenceLabel(recommendation.confidence)}
        </span>
      </div>
      <p className="text-xs text-zinc-200 mt-1">{recommendation.summary}</p>

      {recommendation.suggestedActions.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {recommendation.suggestedActions.map((action, i) => (
            <p key={i} className="text-[11px] text-zinc-400">· {action}</p>
          ))}
        </div>
      )}

      {recommendation.signals.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {recommendation.signals.map((s, i) => (
            <p key={i} className="text-[10px] text-amber-400">{s}</p>
          ))}
        </div>
      )}

      {recommendation.blockers.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {recommendation.blockers.map((b, i) => (
            <p key={i} className="text-[10px] text-red-400">{b}</p>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="h-7 rounded border border-emerald-700/40 bg-emerald-900/20 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
        >
          {isPending ? "Accepting..." : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => setShowRejectModal(true)}
          className="h-7 rounded border border-zinc-700/40 bg-zinc-800/30 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-700/30"
        >
          Reject
        </button>
      </div>

      <div className="mt-1 flex gap-3 text-[10px] text-zinc-500">
        <span>{recommendation.rulesApplied.length} rule{recommendation.rulesApplied.length !== 1 ? "s" : ""}</span>
        <span>{recommendation.crossTeamImpacts.length} impact{recommendation.crossTeamImpacts.length !== 1 ? "s" : ""}</span>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Reject recommendation</h3>
              <p className="text-sm text-zinc-300">A reason is required when rejecting a recommendation that remains unresolved.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejecting..."
                className="rounded-md border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                rows={3}
              />
              {!rejectReason.trim() && (
                <p className="text-xs text-red-400">A reason is required for this decision.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  startTransition(async () => {
                    await createDecision({
                      decisionType,
                      entityType,
                      entityId,
                      recommendationId: recommendation.id,
                      action: "REJECT_RECOMMENDATION",
                      reason: rejectReason.trim(),
                    });
                    setShowRejectModal(false);
                    setRejectReason("");
                  });
                }}
                className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/30 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}