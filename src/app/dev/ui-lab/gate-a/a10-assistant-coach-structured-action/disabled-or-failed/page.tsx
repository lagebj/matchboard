"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useDirtyCloseGuard } from "../../shared/fixture-operation";
import { matchW3Squad, matchW3PlanningPitchSlots, matchW3PlanningPitchAssignments } from "../../shared/match-w3-fixture";
import { LineupProposalInspector, LineupProposalSheet } from "../shared/lineup-proposal-editor";
import { identity, slotLabel, blockedReason } from "./fixtures";
import { matchReference, roundLabel } from "./view-model";

/**
 * A10-disabled-or-failed — "Review lineup" still opens (it stays a reachable action), but no
 * proposal exists: an honest unavailability reason, no Apply, manual editing unaffected.
 */
export default function A10DisabledOrFailedPage() {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const guard = useDirtyCloseGuard(false, false, close);

  const openEditor = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const sharedProps = {
    matchReference,
    slotLabel,
    pitchSlots: matchW3PlanningPitchSlots(),
    pitchAssignments: matchW3PlanningPitchAssignments(matchW3Squad),
    proposal: null,
    blockedReason,
    isDraftSelected: false,
    onSelectCandidate: () => {},
    status: "IDLE" as const,
    outcome: null,
    onConfirm: () => {},
    onResolvePending: () => {},
    onDiscardDraft: () => {},
    confirmingClose: guard.confirming,
    onRequestClose: guard.requestClose,
    onConfirmDiscardAndClose: guard.confirmDiscardAndClose,
    onCancelClose: guard.cancelConfirm,
  };

  return (
    <div className="touchline mx-auto flex max-w-[920px] flex-col gap-6 px-4 py-8 medium:flex-row medium:items-start" data-ui-lab-ready="true">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <Link href="/dev/ui-lab/gate-a/a10-assistant-coach-structured-action" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; A10 Assistant Coach structured action
          </Link>
          <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A10 — Disabled / failed</h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
        </div>

        <AppearanceControl />

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Match Details — BEFORE · Lineup tab</p>
          <p className="mt-1 text-[13px] text-[var(--foreground)]">{matchReference}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{roundLabel}</p>
        </div>

        <TouchlinePlanningPitch slots={matchW3PlanningPitchSlots()} assignments={matchW3PlanningPitchAssignments(matchW3Squad)} readOnly compact className="max-w-[320px]" />

        <button type="button" onClick={openEditor} className="self-start rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]">
          Review lineup
        </button>
      </div>

      {isOpen && isDesktop ? <LineupProposalInspector {...sharedProps} /> : null}
      {isOpen && !isDesktop ? <LineupProposalSheet isOpen={isOpen} {...sharedProps} /> : null}
    </div>
  );
}
