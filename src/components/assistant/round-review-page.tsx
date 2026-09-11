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
    case "BLOCKED": return "border-[var(--danger)]/40 bg-[var(--danger-subtle)] text-[var(--danger)]";
    case "DECISION_REQUIRED": return "border-[var(--warning)]/40 bg-[var(--warning-subtle)] text-[var(--warning)]";
    default: return "border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-muted)]";
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
    return <div className="touchline p-4 text-sm text-[var(--text-muted)]">Loading round review...</div>;
  }

  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Round Review</p>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${getReadinessClasses(review.readinessState)}`}>
            {readinessLabel(review.readinessState)}
          </span>
        </div>
        <Link href={orgUrl("/rounds")} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]">Back to rounds</Link>
      </div>

      <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--foreground)]">{review.title}</p>
          <div className="flex items-center gap-2">
            {review.blockedConditionCount > 0 && (
              <span className="text-[10px] text-[var(--danger)]">{review.blockedConditionCount} Blocked {review.blockedConditionCount !== 1 ? "conditions" : "condition"}</span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">{review.teamReadiness.length} teams</span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Team readiness</p>
        {review.teamReadiness.map((team) => (
          <TeamReadinessCard key={team.teamId} readiness={team} />
        ))}
      </div>

      {signals.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Plan integrity</p>
          {signals.map((signal) => (
            <div key={signal.idempotencyKey} className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase ${signalKindBadgeClass(signal.kind)}`}>
                  {signal.kind === "BLOCKED" ? "Blocked" : "Decision required"}
                </span>
                <span className="text-[var(--text-soft)]">{signal.title}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{signal.currentState}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}