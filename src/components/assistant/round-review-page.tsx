"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { RoundReview } from "@/domain/assistant-manager/types";
import { fetchRoundReview, fetchRoundPlanIntegrity } from "@/domain/assistant-manager/actions";
import { getReadinessClasses } from "@/domain/assistant-manager/utils/issue-grouping";
import { TeamReadinessCard } from "./team-readiness-card";
import { DecisionPanel } from "./decision-panel";

type SignalKind = "BLOCKED" | "DECISION_REQUIRED" | "PLANNING_NOTE";

interface Signal {
  idempotencyKey: string;
  kind: SignalKind;
  title: string;
  currentState: string;
}

function readinessLabel(state: string): string {
  switch (state) {
    case "READY": return "Ready";
    case "WATCH": return "Watch";
    case "AT_RISK": return "At risk";
    case "NOT_PLAYABLE": return "Not playable";
    default: return state;
  }
}

function signalKindBadgeClass(kind: SignalKind): string {
  switch (kind) {
    case "BLOCKED": return "border-red-700/40 bg-red-900/20 text-red-300";
    case "DECISION_REQUIRED": return "border-amber-700/40 bg-amber-900/20 text-amber-300";
    default: return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export function RoundReviewPage({ roundId }: { roundId: string }) {
  const [review, setReview] = useState<RoundReview | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await fetchRoundReview(roundId);
      setReview(r);

      const integrity = await fetchRoundPlanIntegrity(roundId);
      setSignals(integrity);
    });
  }, [roundId, startTransition]);

  if (!review) {
    return <div className="p-4 text-sm text-zinc-500">Loading round review...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Round Review</p>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${getReadinessClasses(review.readinessState)}`}>
            {readinessLabel(review.readinessState)}
          </span>
        </div>
        <Link href="/rounds" className="text-[10px] text-zinc-500 hover:text-zinc-300">Back to rounds</Link>
      </div>

      <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-200">{review.title}</p>
          <div className="flex items-center gap-2">
            {review.blockedConditionCount > 0 && (
              <span className="text-[10px] text-red-400">{review.blockedConditionCount} Blocked {review.blockedConditionCount !== 1 ? "conditions" : "condition"}</span>
            )}
            <span className="text-[10px] text-zinc-500">{review.teamReadiness.length} teams</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">
          {review.finalizeable
            ? "This round is ready to finalise."
            : "Finalisation requires override reason for unresolved conditions."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Team readiness</p>
        {review.teamReadiness.map((team) => (
          <TeamReadinessCard key={team.teamId} readiness={team} />
        ))}
      </div>

      {signals.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Plan integrity</p>
          {signals.map((signal) => (
            <div key={signal.idempotencyKey} className="rounded-md border border-zinc-700/30 bg-zinc-800/15 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase ${signalKindBadgeClass(signal.kind)}`}>
                  {signal.kind === "BLOCKED" ? "Blocked" : "Decision required"}
                </span>
                <span className="text-zinc-300">{signal.title}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">{signal.currentState}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
      {review.finalizeable ? (
        <DecisionPanel
          decisionType="ROUND_REVIEW"
          entityType="ROUND"
          entityId={review.roundId}
          action="FINALIZE"
          actionLabel="Finalise round"
          reasonRequired={false}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled
            className="h-7 rounded border border-zinc-700/40 bg-zinc-800/30 px-3 text-xs font-medium text-zinc-600 cursor-not-allowed"
          >
            Finalize (conditions require review)
          </button>
            <button
              type="button"
              onClick={() => setShowOverrideModal(true)}
              className="h-7 rounded border border-red-700/40 bg-red-900/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-900/30"
            >
              Override and finalize with reason
            </button>
          </div>
        )}
      </div>

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOverrideModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Override and finalize</h3>
              <p className="text-sm text-zinc-300">
                This round has {review.blockedConditionCount} Blocked {review.blockedConditionCount !== 1 ? "conditions" : "condition"}. Overriding requires a reason.
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for overriding Blocked conditions..."
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
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
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
                      decisionType: "ROUND_REVIEW",
                      entityType: "ROUND",
                      entityId: review.roundId,
                      action: "OVERRIDE_BLOCKER",
                      reason: overrideReason.trim(),
                    });
                    setShowOverrideModal(false);
                    setOverrideReason("");
                  });
                }}
                className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
              >
                Override and finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}