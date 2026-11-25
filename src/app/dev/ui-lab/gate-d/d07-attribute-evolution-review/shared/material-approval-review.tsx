"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { cumulativeDelta, requiresCoachApproval, APPROVAL_CUMULATIVE_TRIGGER } from "./materiality-policy";

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
 * `currentAppliedValue` and `proposedValue` are deliberately separate fields — the proposal is
 * NOT yet applied. A prior version of this fixture collapsed three individually-eligible
 * one-point automatic steps (6→7→8→9) into a single pending proposal of 9, which contradicted
 * ADR-0160 §4's own math (cumulative movement crosses the two-point approval trigger at the
 * *second* step, not the third) — corrected 2026-11-24. See `materiality-policy.ts` for the one
 * shared, independently-tested threshold calculation this component and its fixtures both use.
 *
 * Accept/reject are simulated: no Server Action is called, no `AssessmentChange` row is written.
 */
export type MaterialApprovalProposal = {
  attributeKey: string;
  attributeLabel: string;
  baselineValue: number;
  baselineSource: "COACH_ESTABLISHED" | "COACH_APPROVED";
  /** The last value actually applied automatically — real, already written, not pending. */
  currentAppliedValue: number;
  /** The new candidate value awaiting a coach decision — NOT yet applied. */
  proposedValue: number;
  matchCount: number;
  confidence: number;
  evidenceSummary: string[];
};

export function MaterialApprovalReview({ proposal }: { proposal: MaterialApprovalProposal }) {
  const [decision, setDecision] = useState<"PENDING" | "ACCEPTED" | "REJECTED">("PENDING");

  const appliedDelta = cumulativeDelta(proposal.baselineValue, proposal.currentAppliedValue);
  const cumulativeIfAccepted = cumulativeDelta(proposal.baselineValue, proposal.proposedValue);
  const approvalRequired = requiresCoachApproval(proposal.baselineValue, proposal.proposedValue);

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
          description={`Accepting this proposal would move ${cumulativeIfAccepted >= 0 ? "+" : ""}${cumulativeIfAccepted} points from the coach-established baseline — ADR-0160 §4 requires explicit approval once cumulative movement reaches ${APPROVAL_CUMULATIVE_TRIGGER} or more points.`}
        />
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
          <div>
            <dt className="uppercase tracking-wide">Baseline</dt>
            <dd className="font-mono text-sm text-[var(--foreground)]" data-testid="baseline-value">
              {proposal.baselineValue}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Current (applied)</dt>
            <dd className="font-mono text-sm text-[var(--foreground)]" data-testid="current-applied-value">
              {proposal.currentAppliedValue}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Proposed (pending)</dt>
            <dd className="font-mono text-sm text-[var(--foreground)]" data-testid="proposed-value">
              {proposal.proposedValue}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Already applied automatically: {appliedDelta >= 0 ? "+" : ""}
          {appliedDelta} from baseline (within the one-point automatic cap). This pending proposal
          would bring cumulative movement to {cumulativeIfAccepted >= 0 ? "+" : ""}
          {cumulativeIfAccepted}, {approvalRequired ? "crossing" : "staying under"} the
          {` ${APPROVAL_CUMULATIVE_TRIGGER}`}-point approval trigger.
        </p>
        <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
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
            {decision === "ACCEPTED"
              ? `Accepted (simulated — would apply ${proposal.proposedValue} as the new current value; no record written).`
              : `Rejected (simulated — current value remains ${proposal.currentAppliedValue}; no record written).`}
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
