"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { RoundReview } from "@/domain/assistant-manager/types";
import { fetchRoundReview, fetchRoundPlanIntegrity } from "@/domain/assistant-manager/actions";
import { getReadinessClasses } from "@/domain/assistant-manager/utils/issue-grouping";
import { TeamReadinessCard } from "./team-readiness-card";
import { useOrgUrl } from "@/components/shell/org-slug-context";

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
  const orgUrl = useOrgUrl();
  const [review, setReview] = useState<RoundReview | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
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
        <Link href={orgUrl("/rounds")} className="text-[10px] text-zinc-500 hover:text-zinc-300">Back to rounds</Link>
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
          {review.blockedConditionCount === 0 && review.decisionRequiredCount === 0
            ? "No unresolved conditions. This round becomes historical automatically as each match's planning boundary closes (scheduled kickoff, or live reporting starting) — there is no finalise step."
            : `${review.blockedConditionCount} Blocked / ${review.decisionRequiredCount} Decision required condition${review.blockedConditionCount + review.decisionRequiredCount === 1 ? "" : "s"} to resolve on the Round Board before the planning boundary closes.`}
        </p>
        {(review.blockedConditionCount > 0 || review.decisionRequiredCount > 0) && (
          <Link
            href={orgUrl(`/rounds/${review.roundId}`)}
            className="mt-2 inline-block text-[11px] font-medium text-[var(--accent)] hover:underline"
          >
            Open the Round Board →
          </Link>
        )}
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

    </div>
  );
}