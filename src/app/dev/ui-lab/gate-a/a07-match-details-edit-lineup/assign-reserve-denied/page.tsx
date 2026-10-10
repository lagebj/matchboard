"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { useFixtureOperation, useDirtyCloseGuard } from "../../shared/fixture-operation";
import { matchW3Squad, matchW3PlanningPitchSlots, matchW3PlanningPitchAssignments, withTacticalAssignment, type MatchW3SquadMember } from "../../shared/match-w3-fixture";
import { LineupSlotInspector, LineupSlotSheet, type LineupAssignmentSuccess } from "../shared/lineup-slot-editor";
import { identity, slotLabel, candidate, predeclaredOutcome } from "./fixtures";
import { matchReference, roundLabel } from "./view-model";

/**
 * A07-S3 — same open/draft/preview flow as S1/S2, but Confirm resolves to PERMISSION_DENIED. The
 * pitch must still show 6 assignments (RCM empty) after resolving — the state-machine invariant
 * that a non-SUCCESS outcome never touches authoritative state.
 */
export default function AssignReserveDeniedPage() {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const triggerRef = useRef<HTMLElement | null>(null);

  const op = useFixtureOperation<MatchW3SquadMember[], { playerId: string; position: CanonicalTacticalPosition }, LineupAssignmentSuccess>(
    [...matchW3Squad],
    (authoritative, draft) => withTacticalAssignment(authoritative, draft.playerId, draft.position),
  );

  const close = () => {
    op.discardDraft();
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const guard = useDirtyCloseGuard(op.draft !== null && op.status !== "SUCCESS", close);

  const openEditor = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const sharedProps = {
    matchReference,
    slotLabel,
    pitchSlots: matchW3PlanningPitchSlots(),
    pitchAssignments: matchW3PlanningPitchAssignments(op.authoritative),
    candidate,
    isDraftSelected: op.draft !== null,
    onSelectCandidate: () => op.setDraft(op.draft ? null : { playerId: candidate.playerId, position: slotLabel }),
    status: op.status,
    outcome: op.outcome,
    onConfirm: () => op.submit(predeclaredOutcome),
    onResolvePending: op.resolvePending,
    onDiscardDraft: op.discardDraft,
    confirmingClose: guard.confirming,
    onRequestClose: guard.requestClose,
    onConfirmDiscardAndClose: guard.confirmDiscardAndClose,
    onCancelClose: guard.cancelConfirm,
  };

  return (
    <div className="touchline mx-auto flex max-w-[920px] flex-col gap-6 px-4 py-8 medium:flex-row medium:items-start" data-ui-lab-ready="true">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <Link href="/dev/ui-lab/gate-a/a07-match-details-edit-lineup" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; A07 Match Details edit lineup
          </Link>
          <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A07-S3 — Permission denied</h1>
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
          Edit lineup
        </button>
      </div>

      {isOpen && isDesktop ? <LineupSlotInspector {...sharedProps} /> : null}
      {isOpen && !isDesktop ? <LineupSlotSheet isOpen={isOpen} {...sharedProps} /> : null}
    </div>
  );
}
