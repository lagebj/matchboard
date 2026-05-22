"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { MatchReview } from "@/domain/assistant-manager/types";
import { fetchMatchReview } from "@/domain/assistant-manager/actions";
import { RuleImpactPanel } from "./rule-impact-panel";
import { CrossTeamImpactPanel } from "./cross-team-impact-panel";
import { RecommendationPanel } from "./recommendation-panel";
import { DecisionPanel } from "./decision-panel";

function _readinessLabel(state: string): string {
  switch (state) {
    case "READY": return "Ready";
    case "WATCH": return "Watch";
    case "AT_RISK": return "At risk";
    case "NOT_PLAYABLE": return "Not playable";
    default: return state;
  }
}

export function MatchReviewPage({ matchId }: { matchId: string }) {
  const [review, setReview] = useState<MatchReview | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchMatchReview(matchId);
      setReview(data);
    });
  }, [matchId, startTransition]);

  if (!review) {
    return <div className="p-4 text-sm text-zinc-500">Loading match review...</div>;
  }

  const hasBlockers = review.blockedPlayerIds.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Match Review</p>
        <Link href="/fixtures" className="text-[10px] text-zinc-500 hover:text-zinc-300">Back to fixtures</Link>
      </div>

      <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <p className="text-sm font-medium text-zinc-200">{matchId}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Selected: {review.selectedPlayerIds.length} · Unavailable: {review.unavailablePlayerIds.length} · Unknown RSVP: {review.unknownRsvpPlayerIds.length} · Blocked: {review.blockedPlayerIds.length}
        </p>
        {review.positionGaps.length > 0 && (
          <p className="text-[11px] text-amber-400 mt-0.5">Position gaps: {review.positionGaps.join(", ")}</p>
        )}
      </div>

      {review.recommendations.length > 0 && review.recommendations.map((rec) => (
        <RecommendationPanel key={rec.id} recommendation={rec} />
      ))}

      {review.ruleImpacts.length > 0 && (
        <RuleImpactPanel ruleImpacts={review.ruleImpacts} />
      )}

      {review.crossTeamImpacts.length > 0 && (
        <CrossTeamImpactPanel impacts={review.crossTeamImpacts} />
      )}

      <div className="flex items-center gap-2">
        <DecisionPanel
          decisionType="MATCH_REVIEW"
          entityType="MATCH"
          entityId={matchId}
          action="APPROVE_DRAFT"
          actionLabel="Approve draft"
          reasonRequired={false}
        />
        <DecisionPanel
          decisionType="MATCH_REVIEW"
          entityType="MATCH"
          entityId={matchId}
          action="REJECT_DRAFT"
          actionLabel="Reject draft"
          reasonRequired={true}
        />
      </div>

      {hasBlockers && (
        <button
          type="button"
          onClick={() => setShowOverrideModal(true)}
          className="h-7 rounded border border-red-700/40 bg-red-900/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-900/30"
        >
          Override blocker
        </button>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOverrideModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Override blocker</h3>
              <p className="text-sm text-zinc-300">This match has blocked players. Overriding requires a reason.</p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for overriding blockers..."
                className="rounded-md border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                rows={3}
              />
              {!overrideReason.trim() && (
                <p className="text-xs text-red-400">A reason is required for this decision.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const { createDecision } = await import("@/domain/assistant-manager/actions");
                    await createDecision({
                      decisionType: "MATCH_REVIEW",
                      entityType: "MATCH",
                      entityId: matchId,
                      action: "OVERRIDE_BLOCKER",
                      reason: overrideReason.trim(),
                    });
                    setShowOverrideModal(false);
                    setOverrideReason("");
                  });
                }}
                className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
              >
                Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}