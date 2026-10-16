"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { useFixtureOperation, useDirtyCloseGuard } from "../../shared/fixture-operation";
import { matchW3Squad, matchW3PlanningPitchSlots, matchW3PlanningPitchAssignments, withTacticalAssignment, type MatchW3SquadMember } from "../../shared/match-w3-fixture";
import { LineupProposalInspector, LineupProposalSheet, type LineupProposalSuccess } from "../shared/lineup-proposal-editor";
import { identity, slotLabel, proposal, evidence, blockedReason } from "./fixtures";
import { matchReference, roundLabel, candidateDisplayName, candidateShirtNumber } from "./view-model";

/**
 * A10-stale-proposal-blocked — the proposal is inspectable (evidence sources, rationale, diff
 * preview), but no Apply affordance renders at all: Apply is blocked structurally by a stale
 * source revision (`validateLineupProposal` returns `applicability: "STALE"`), discovered before
 * any submit, never as a server CONFLICT after confirming.
 */
export default function A10StaleProposalBlockedPage() {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const triggerRef = useRef<HTMLElement | null>(null);

  const op = useFixtureOperation<MatchW3SquadMember[], { playerId: string; position: CanonicalTacticalPosition }, LineupProposalSuccess>(
    [...matchW3Squad],
    (authoritative, draft) => withTacticalAssignment(authoritative, draft.playerId, draft.position),
  );

  const close = () => {
    op.discardDraft();
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const guard = useDirtyCloseGuard(op.draft !== null, op.status === "PENDING", close);

  const openEditor = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const sharedProps = {
    matchReference,
    slotLabel,
    pitchSlots: matchW3PlanningPitchSlots(),
    pitchAssignments: matchW3PlanningPitchAssignments(op.authoritative),
    proposal,
    candidateDisplayName,
    candidateShirtNumber,
    evidence,
    blockedReason,
    isDraftSelected: op.draft !== null,
    onSelectCandidate: () => op.setDraft(op.draft ? null : { playerId: proposal.playerId, position: slotLabel }),
    status: op.status,
    outcome: op.outcome,
    onConfirm: () => {
      // Apply never renders for a stale proposal — this is unreachable in practice, kept only to
      // satisfy the shared editor's prop contract.
    },
    onResolvePending: op.resolvePending,
    onDiscardDraft: op.discardDraft,
    confirmingClose: guard.confirming,
    onRequestClose: guard.requestClose,
    onConfirmDiscardAndClose: guard.confirmDiscardAndClose,
    onCancelClose: guard.cancelConfirm,
  };

  return (
    <div className="touchline mx-auto flex max-w-[920px] flex-col gap-6 px-4 py-8 expanded:flex-row expanded:items-start" data-ui-lab-ready="true">
      <div className="flex min-w-0 flex-col gap-6 expanded:w-[480px] expanded:shrink-0">
        <div>
          <Link href="/dev/ui-lab/gate-a/a10-assistant-coach-structured-action" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; A10 Assistant Coach structured action
          </Link>
          <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A10 — Stale proposal (blocked)</h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
        </div>

        <AppearanceControl />

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Match Details — BEFORE · Lineup tab</p>
          <p className="mt-1 text-[13px] text-[var(--foreground)]">{matchReference}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{roundLabel}</p>
        </div>

        <TouchlinePlanningPitch slots={matchW3PlanningPitchSlots()} assignments={matchW3PlanningPitchAssignments(op.authoritative)} readOnly compact className="max-w-[320px]" />

        <button type="button" onClick={openEditor} className="self-start rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]">
          Review lineup
        </button>
      </div>

      {isOpen && isDesktop ? <LineupProposalInspector {...sharedProps} className="expanded:flex-1" /> : null}
      {isOpen && !isDesktop ? <LineupProposalSheet isOpen={isOpen} {...sharedProps} /> : null}
    </div>
  );
}
