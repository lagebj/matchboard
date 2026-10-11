"use client";

import { StatusPill } from "@/components/ui/status-pill";
import { TouchlineButton } from "@/components/touchline";
import type { EvidenceRef } from "@/lib/development-context/types";

/**
 * A11 "guarded profile change review" (register row 38 + `04_ASSISTANT_COACH_AND_PLAYER_
 * MUTATIONS.md`'s own "Candidate UI Lab states": "before/after primary proposal with evidence,
 * accept/reject/defer and audit; no direct provider write"). Deliberately NOT a
 * `useFixtureOperation` draft/PENDING/predeclared-server-outcome flow like A07/A10 — the source
 * doc describes a direct accept/reject/defer decision with an immediate simulated outcome, not a
 * server round-trip with a revision/conflict concept. The materiality threshold shown here is an
 * explicit, disclosed HYPOTHETICAL fixture value — `04`'s own "Mandatory gates before profile
 * mutation work" (materiality, hysteresis, audit, legacy migration) are unresolved product
 * decisions; see `docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md` W4-BLK-09. This never claims
 * `docs/adr/0139-evolving-player-position-model.md`'s current auto-promotion already works this
 * way — it demonstrates the future, coach-approved target instead.
 */
export type ProfilePrimaryPositionProposal = {
  playerId: string;
  playerName: string;
  currentPrimary: string;
  proposedPrimary: string;
  evidenceRefs: EvidenceRef[];
  materialityNote: string;
  limitations: string[];
};

export type ProfileChangeReviewOutcome = "ACCEPTED" | "REJECTED" | "DEFERRED" | null;

function describeRefs(refs: EvidenceRef[]): string {
  return refs.map((ref) => ref.label ?? ref.kind).join(", ");
}

export function ProfileChangeReviewCard({
  proposal,
  outcome,
  onAccept,
  onReject,
  onDefer,
}: {
  proposal: ProfilePrimaryPositionProposal;
  outcome: ProfileChangeReviewOutcome;
  onAccept: () => void;
  onReject: () => void;
  onDefer: () => void;
}) {
  if (outcome) {
    return (
      <div role="status" data-testid="profile-change-outcome" className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
        <p className="text-[13px] font-[700] text-[var(--foreground)]">
          {outcome === "ACCEPTED" && "Accepted (simulated) — declared primary updated for this fixture only"}
          {outcome === "REJECTED" && "Rejected (simulated) — no change made"}
          {outcome === "DEFERRED" && "Deferred (simulated) — revisit later, no change made"}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">No real provider or database write occurred. Production authorization not verified.</p>
      </div>
    );
  }

  return (
    <div data-testid="profile-change-review-card" className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <div className="flex items-center justify-between gap-2">
        <StatusPill size="sm" variant="development">
          Guarded profile change review
        </StatusPill>
      </div>
      <p className="mt-2 text-[13px] text-[var(--foreground)]" data-testid="profile-change-diff">
        <span className="font-[650]">Declared primary:</span> {proposal.currentPrimary} → {proposal.proposedPrimary}
      </p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">Evidence: {describeRefs(proposal.evidenceRefs)}</p>
      {proposal.limitations.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {proposal.limitations.map((l) => (
            <li key={l} className="text-[11px] text-[var(--text-soft)]">
              Limitation: {l}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] italic text-[var(--text-muted)]" data-testid="materiality-note">
        {proposal.materialityNote}
      </p>
      <p className="mt-2 text-[11px] italic text-[var(--text-muted)]">
        This is a proposed change, not an automatic update. It never changes the player&apos;s declared primary position on its own.
      </p>
      <div className="mt-3 flex gap-2">
        <TouchlineButton variant="primary" size="sm" onClick={onAccept}>
          Accept change
        </TouchlineButton>
        <TouchlineButton variant="ghost" size="sm" onClick={onReject}>
          Reject
        </TouchlineButton>
        <TouchlineButton variant="ghost" size="sm" onClick={onDefer}>
          Defer
        </TouchlineButton>
      </div>
    </div>
  );
}
