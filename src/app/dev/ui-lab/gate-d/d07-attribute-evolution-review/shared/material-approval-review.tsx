"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * Directional design candidate for ADR-0160 §4's "coach approval mandatory when the proposed
 * change would move an attribute two or more cumulative points from baseline" — this review
 * surface does not exist in production yet (confirmed: `AssessmentChange` has no pending/decided
 * status distinct from an already-applied change; `recordAssessmentChange`'s automatic path never
 * sets `decidedAt`/`decidedBy`, and no schema field distinguishes "automatic, no decision needed"
 * from "awaiting decision"). This is new, UI-Lab-only presentation demonstrating the decided
 * policy, not a mount of an existing production component — unlike `AssessmentHistoryDisplay`,
 * which mirrors a real one. See `VISUAL_VS_CURRENT.md` and `BLOCKERS.md` for the disclosure.
 *
 * Accept/reject are simulated: no Server Action is called, no `AssessmentChange` row is written.
 */
export type MaterialApprovalProposal = {
  attributeKey: string;
  attributeLabel: string;
  baselineValue: number;
  baselineSource: "COACH_ESTABLISHED" | "COACH_APPROVED";
  proposedValue: number;
  cumulativeAutomaticDelta: number;
  matchCount: number;
  confidence: number;
  evidenceSummary: string[];
};

export function MaterialApprovalReview({ proposal }: { proposal: MaterialApprovalProposal }) {
  const [decision, setDecision] = useState<"PENDING" | "ACCEPTED" | "REJECTED">("PENDING");

  const simulatedAccept = async () => {
    setDecision("ACCEPTED");
  };
  const simulatedReject = async () => {
    setDecision("REJECTED");
  };

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title={`${proposal.attributeLabel} — approval required`}
          description={`Proposed change moves ${proposal.cumulativeAutomaticDelta >= 0 ? "+" : ""}${proposal.cumulativeAutomaticDelta} points from the last coach-established baseline (ADR-0160 §4: ≥2 cumulative points requires explicit approval).`}
        />
        <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-mono">
            {proposal.baselineValue} → {proposal.proposedValue}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {proposal.matchCount} matches · confidence {proposal.confidence.toFixed(2)}
          </span>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
          {proposal.evidenceSummary.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
        {decision === "PENDING" ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={simulatedAccept}
              className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)]"
            >
              Accept
            </button>
            <button type="button" onClick={simulatedReject} className="rounded-md border px-3 py-1.5 text-sm">
              Reject
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium" data-testid="decision-result">
            {decision === "ACCEPTED" ? "Accepted (simulated — no record written)." : "Rejected (simulated — no record written)."}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Accept/Reject on this candidate are simulated: no Server Action is called, no
          AssessmentChange row is written. This review surface does not exist in production yet.
        </p>
      </div>
    </Surface>
  );
}
