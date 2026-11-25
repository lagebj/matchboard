"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { exactPositionLabel } from "@/lib/touchline/presentation/exact-position-labels";
import { collapseTacticalToProfile, type ProfilePosition } from "@/app/dev/ui-lab/gate-a/shared/profile-position-model";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

/**
 * Directional design candidate for ADR-0160 §1/§6 — a primary-position change proposal awaiting
 * explicit coach approval. This review surface does not exist in production yet (ADR-0139's
 * `evolvePlayerPositionProfile()` still writes automatically; this is the decided-but-unimplemented
 * replacement). Reuses the real, tested `collapseTacticalToProfile()` from Gate A's own
 * `a12-profile-editor` directional study (the one place in this repo that already implements the
 * 14-role mapping table) rather than reimplementing it a third time — see
 * `DATA_TRUTH_AND_FIXTURES.md`. The proposed primary is always shown as a 14-role profile code
 * (`ProfilePosition`), never a sided/central tactical code, per ADR-0160 §6.
 *
 * Accept/Reject/Defer are simulated: no Server Action is called, no `Player.primaryPosition` or
 * `DecisionRecord` row is written.
 */
export type PositionProposal = {
  currentPrimaryTactical: CanonicalTacticalPosition;
  strongestEvidenceTactical: CanonicalTacticalPosition;
  confidence: number;
  evidenceSummary: string[];
  conflictingNote?: string;
};

export function PositionProposalReview({ proposal }: { proposal: PositionProposal }) {
  const [decision, setDecision] = useState<"PENDING" | "ACCEPTED" | "REJECTED" | "DEFERRED">("PENDING");

  const currentProfile: ProfilePosition = collapseTacticalToProfile(proposal.currentPrimaryTactical);
  const proposedProfile: ProfilePosition = collapseTacticalToProfile(proposal.strongestEvidenceTactical);

  const simulatedDecide = (next: "ACCEPTED" | "REJECTED" | "DEFERRED") => async () => {
    setDecision(next);
  };

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Primary position proposal"
          description={`Evidence suggests ${proposedProfile} over the current declared ${currentProfile}.`}
        />
        <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-mono">
            {currentProfile} → {proposedProfile}
          </span>
          <span className="text-xs text-[var(--text-muted)]">confidence {proposal.confidence.toFixed(2)}</span>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Exact recorded evidence: {exactPositionLabel(proposal.strongestEvidenceTactical)} ({proposal.strongestEvidenceTactical})
          — profile proposals always target one of the 14 profile roles, never a sided/central
          tactical code.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
          {proposal.evidenceSummary.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
        {proposal.conflictingNote && (
          <p className="mt-3 rounded-md border border-[var(--warning)] px-3 py-2 text-xs text-[var(--warning)]">
            Conflicting note: {proposal.conflictingNote}
          </p>
        )}
        {decision === "PENDING" ? (
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={simulatedDecide("ACCEPTED")} className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)]">
              Accept
            </button>
            <button type="button" onClick={simulatedDecide("REJECTED")} className="rounded-md border px-3 py-1.5 text-sm">
              Reject
            </button>
            <button type="button" onClick={simulatedDecide("DEFERRED")} className="rounded-md border px-3 py-1.5 text-sm">
              Defer
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium" data-testid="decision-result">
            {decision === "ACCEPTED" && "Accepted (simulated — no record written)."}
            {decision === "REJECTED" && "Rejected (simulated — no record written)."}
            {decision === "DEFERRED" && "Deferred (simulated — no record written)."}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Accept/Reject/Defer on this candidate are simulated: no Server Action is called, no
          position record is written. This review surface does not exist in production yet.
        </p>
      </div>
    </Surface>
  );
}
