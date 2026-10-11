"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { TouchlineBottomSheet } from "@/components/touchline/overlay/touchline-bottom-sheet";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { FixtureOperationOutcome, FixtureOperationStatus } from "../../shared/fixture-operation";

/**
 * A10 "Review lineup alternative" editor — same desktop-inspector/mobile-sheet chrome pattern as
 * A07's `lineup-slot-editor.tsx` (XR-I01: stays in Match Details), but the body is a structured
 * Assistant Coach PROPOSAL (`06_STRUCTURED_PROPOSAL_AND_OPERATION_CONTRACT.md`-equivalent: exact
 * subject, evidence refs, rationale distinct from evidence, limitations, expected consequences),
 * not a plain "already in squad" candidate row. A07's own `LineupSlotEditorBody` is deliberately
 * NOT reused here — its candidate shape has no evidence/rationale/limitations fields, and
 * `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` XR-I01's "Review lineup / Explore alternatives" is a
 * materially different action from a plain manual assignment, even though both resolve through
 * the same `useFixtureOperation` state machine.
 */
export type LineupProposalCandidate = {
  proposalId: string;
  playerId: string;
  displayName: string;
  shirtNumber: number;
  evidenceRefs: string[];
  rationale: string;
  limitations: string[];
  expectedConsequences: string[];
};

export type LineupProposalSuccess = { assignedPlayerId: string; slotLabel: string };

/** `null` when staleness/unavailability means there is nothing eligible to review at all. */
export type ProposalBlockedReason = { kind: "STALE"; message: string } | { kind: "UNAVAILABLE"; message: string };

export type LineupProposalEditorBodyProps = {
  matchReference: string;
  slotLabel: string;
  pitchSlots: PlanningPitchSlot[];
  pitchAssignments: PlanningPitchAssignment[];
  proposal: LineupProposalCandidate | null;
  blockedReason: ProposalBlockedReason | null;
  isDraftSelected: boolean;
  onSelectCandidate: () => void;
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<LineupProposalSuccess> | null;
  onConfirm: () => void;
  onResolvePending: () => void;
  onDiscardDraft: () => void;
};

export function LineupProposalEditorBody({
  matchReference,
  slotLabel,
  pitchSlots,
  pitchAssignments,
  proposal,
  blockedReason,
  isDraftSelected,
  onSelectCandidate,
  status,
  outcome,
  onConfirm,
  onResolvePending,
  onDiscardDraft,
}: LineupProposalEditorBodyProps) {
  const currentSlotAssignment = pitchAssignments.find((a) => a.slotId === `slot-${slotLabel}`);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-[var(--text-muted)]">{matchReference}</p>

      <TouchlinePlanningPitch slots={pitchSlots} assignments={pitchAssignments} readOnly compact className="max-w-[260px]" />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{slotLabel} slot</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">{currentSlotAssignment ? currentSlotAssignment.name : "Currently unfilled"}</p>
      </div>

      {blockedReason ? (
        <div role="status" data-testid="proposal-blocked-reason" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
          <p className="text-[13px] font-[700] text-[var(--foreground)]">
            {blockedReason.kind === "STALE" ? "This proposal is stale — revalidate before applying" : "No lineup alternative can be proposed right now"}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{blockedReason.message}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">You can still edit the lineup manually from the pitch — Assistant Coach is advisory only.</p>
        </div>
      ) : null}

      {proposal ? (
        <div data-testid="lineup-proposal-card">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Assistant Coach proposal</p>
          <button
            type="button"
            data-testid="lineup-proposal-row"
            onClick={onSelectCandidate}
            disabled={status === "PENDING" || status === "SUCCESS"}
            aria-pressed={isDraftSelected}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left",
              isDraftSelected ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-soft)]",
            )}
          >
            <div>
              <p className="text-[13px] font-[600] text-[var(--foreground)]">
                {proposal.displayName} · №{proposal.shirtNumber}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{proposal.rationale}</p>
              {proposal.limitations.length > 0 ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {proposal.limitations.map((l) => (
                    <li key={l} className="text-[11px] text-[var(--text-soft)]">
                      Limitation: {l}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-[11px] text-[var(--text-muted)]" data-testid="proposal-evidence-count">
                Based on {proposal.evidenceRefs.length} cited source{proposal.evidenceRefs.length === 1 ? "" : "s"}.
              </p>
            </div>
            <span aria-hidden="true" className="text-[11px] text-[var(--text-muted)]">
              {isDraftSelected ? "Selected ✓" : "Select"}
            </span>
          </button>

          {isDraftSelected ? (
            <div data-testid="lineup-diff-preview" className="mt-3 rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
              <p>
                <span className="font-[650]">{slotLabel}:</span> {currentSlotAssignment ? currentSlotAssignment.name : "Empty"} → {proposal.displayName} — draft, not yet applied.
              </p>
              {proposal.expectedConsequences.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {proposal.expectedConsequences.map((c) => (
                    <li key={c} className="text-[11px] text-[var(--text-muted)]">
                      Expected: {c} — advisory only, not a guaranteed outcome.
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <LineupProposalStatusBanner status={status} outcome={outcome} onResolvePending={onResolvePending} />

      {proposal && !blockedReason ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isDraftSelected || status === "PENDING" || status === "SUCCESS"}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)] disabled:opacity-50"
          >
            Apply proposal
          </button>
          {isDraftSelected && status !== "SUCCESS" ? (
            <button type="button" onClick={onDiscardDraft} className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[13px] text-[var(--foreground)]">
              Discard draft
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="fixture-simulation-caption">
        Fixture-only simulated review · No server called · Production authorization not verified.
      </p>
    </div>
  );
}

function LineupProposalStatusBanner({
  status,
  outcome,
  onResolvePending,
}: {
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<LineupProposalSuccess> | null;
  onResolvePending: () => void;
}) {
  if (status === "PENDING") {
    return (
      <div role="status" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[600] text-[var(--foreground)]">Applying… (fixture simulation)</p>
        <button type="button" onClick={onResolvePending} className="mt-2 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] text-[var(--foreground)]">
          Continue fixture simulation →
        </button>
      </div>
    );
  }
  if (status === "SUCCESS" && outcome?.kind === "SUCCESS") {
    return (
      <div role="status" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[700] text-[var(--foreground)]">Saved (simulated)</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">No server called. Production authorization not verified.</p>
      </div>
    );
  }
  return null;
}

type ChromeProps = LineupProposalEditorBodyProps & {
  confirmingClose: boolean;
  onRequestClose: () => void;
  onConfirmDiscardAndClose: () => void;
  onCancelClose: () => void;
};

function DiscardConfirmPrompt({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-label="Discard draft?" className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] p-3">
      <p className="text-[13px] font-[700] text-[var(--foreground)]">Discard this change?</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Your draft selection has not been applied.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onConfirm} data-testid="confirm-discard-and-close" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-[700] text-[var(--tl-accent-on-fill)]">
          Discard and close
        </button>
        <button type="button" onClick={onCancel} data-testid="keep-editing" className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] text-[var(--foreground)]">
          Keep editing
        </button>
      </div>
    </div>
  );
}

export function LineupProposalInspector({ confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, ...body }: ChromeProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onRequestClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onRequestClose]);

  return (
    <aside
      aria-label="Review lineup"
      role="dialog"
      aria-modal="false"
      className="flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Review lineup</p>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--foreground)]">{body.slotLabel} slot</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onRequestClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <LineupProposalEditorBody {...body} />}
    </aside>
  );
}

export function LineupProposalSheet({ isOpen, confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, ...body }: ChromeProps & { isOpen: boolean }) {
  return (
    <TouchlineBottomSheet isOpen={isOpen} onClose={onRequestClose} title="Review lineup" description={`${body.slotLabel} slot — ${body.matchReference}`} tone="context" ariaLabel="Review lineup">
      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <LineupProposalEditorBody {...body} />}
    </TouchlineBottomSheet>
  );
}
