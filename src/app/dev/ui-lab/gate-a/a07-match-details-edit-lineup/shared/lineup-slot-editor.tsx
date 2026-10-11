"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { TouchlineBottomSheet } from "@/components/touchline/overlay/touchline-bottom-sheet";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { FixtureOperationOutcome, FixtureOperationStatus } from "../../shared/fixture-operation";

/**
 * A07 shared desktop-inspector / mobile-sheet lineup editor (bundle `03_INTERACTION_AND_POLICY_
 * CONTRACT.md` "A07 Match Details": "Display current selection, exact tactical slot, intended
 * substitute, slot/pitch effect and submit/undo/discard choices"). One body, two chrome wrappers —
 * same pattern as Round Board's `PlayerAssignmentInspector`/`PlayerAssignmentSheet` and A01's
 * `LineupContextualInspector`/`TouchlineBottomSheet` pair, confirmed by research before building
 * this rather than inventing a third dialog pattern.
 *
 * Renders the REAL `TouchlinePlanningPitch` with the match's current (authoritative) assignments
 * only — the proposed change is shown as an explicit text diff, never as an ambiguous pitch-only
 * visual state, so "has this actually been saved yet" is never in doubt from the pitch alone.
 */
export type LineupEditorCandidate = {
  playerId: string;
  displayName: string;
  shirtNumber: number;
  reasons: string[];
};

export type LineupAssignmentSuccess = { assignedPlayerId: string; slotLabel: string };

export type LineupSlotEditorBodyProps = {
  matchReference: string;
  slotLabel: string;
  pitchSlots: PlanningPitchSlot[];
  pitchAssignments: PlanningPitchAssignment[];
  candidate: LineupEditorCandidate;
  isDraftSelected: boolean;
  onSelectCandidate: () => void;
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<LineupAssignmentSuccess> | null;
  onConfirm: () => void;
  onResolvePending: () => void;
  onDiscardDraft: () => void;
};

export function LineupSlotEditorBody({
  matchReference,
  slotLabel,
  pitchSlots,
  pitchAssignments,
  candidate,
  isDraftSelected,
  onSelectCandidate,
  status,
  outcome,
  onConfirm,
  onResolvePending,
  onDiscardDraft,
}: LineupSlotEditorBodyProps) {
  const currentSlotAssignment = pitchAssignments.find((a) => a.slotId === `slot-${slotLabel}`);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-[var(--text-muted)]">{matchReference}</p>

      <TouchlinePlanningPitch slots={pitchSlots} assignments={pitchAssignments} readOnly compact className="max-w-[260px]" />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{slotLabel} slot</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">
          {currentSlotAssignment ? currentSlotAssignment.name : "Currently unfilled"}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Eligible candidate — already in squad</p>
        <button
          type="button"
          data-testid="lineup-candidate-row"
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
              {candidate.displayName} · №{candidate.shirtNumber}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {candidate.reasons.map((r) => (
                <li key={r} className="text-[11px] text-[var(--text-soft)]">
                  ✓ {r}
                </li>
              ))}
            </ul>
          </div>
          <span aria-hidden="true" className="text-[11px] text-[var(--text-muted)]">
            {isDraftSelected ? "Selected ✓" : "Select"}
          </span>
        </button>
      </div>

      {isDraftSelected ? (
        <p data-testid="lineup-diff-preview" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
          <span className="font-[650]">{slotLabel}:</span> {currentSlotAssignment ? currentSlotAssignment.name : "Empty"} →{" "}
          {candidate.displayName} — draft, not yet saved.
        </p>
      ) : null}

      <LineupStatusBanner status={status} outcome={outcome} onResolvePending={onResolvePending} onDiscardDraft={onDiscardDraft} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!isDraftSelected || status === "PENDING" || status === "SUCCESS"}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)] disabled:opacity-50"
        >
          Confirm assignment
        </button>
        {isDraftSelected && status !== "SUCCESS" ? (
          <button type="button" onClick={onDiscardDraft} className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[13px] text-[var(--foreground)]">
            Discard draft
          </button>
        ) : null}
      </div>

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="fixture-simulation-caption">
        Fixture-only simulated save · No server called · Production authorization not verified.
      </p>
    </div>
  );
}

function LineupStatusBanner({
  status,
  outcome,
  onResolvePending,
  onDiscardDraft,
}: {
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<LineupAssignmentSuccess> | null;
  onResolvePending: () => void;
  onDiscardDraft: () => void;
}) {
  if (status === "PENDING") {
    return (
      <div role="status" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[600] text-[var(--foreground)]">Saving… (fixture simulation)</p>
        <button
          type="button"
          onClick={onResolvePending}
          className="mt-2 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] text-[var(--foreground)]"
        >
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
  if (status === "PERMISSION_DENIED" && outcome?.kind === "PERMISSION_DENIED") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] p-3">
        <p className="text-[13px] font-[700] text-[var(--danger)]">Permission denied</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.reason}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Draft preserved. No change was made to the saved lineup.</p>
      </div>
    );
  }
  if (status === "CONFLICT" && outcome?.kind === "CONFLICT") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] p-3">
        <p className="text-[13px] font-[700] text-[var(--warning)]">Server conflict — recheck before continuing</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.currentSummary}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Expected revision {outcome.expectedRevision}, current revision {outcome.currentRevision}. No automatic merge. Draft preserved for review.
        </p>
        <button type="button" onClick={onDiscardDraft} className="mt-2 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] text-[var(--foreground)]">
          Discard draft
        </button>
      </div>
    );
  }
  if (status === "PLANNING_CLOSED" && outcome?.kind === "PLANNING_CLOSED") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[700] text-[var(--foreground)]">Planning is closed for this match</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.reason}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">No save is possible. Draft preserved for inspection only.</p>
      </div>
    );
  }
  if (status === "SERVER_ERROR" && outcome?.kind === "SERVER_ERROR") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] p-3">
        <p className="text-[13px] font-[700] text-[var(--danger)]">Could not save</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.reason}</p>
      </div>
    );
  }
  return null;
}

function DiscardConfirmPrompt({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-label="Discard draft?" className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] p-3">
      <p className="text-[13px] font-[700] text-[var(--foreground)]">Discard this change?</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Your draft assignment has not been saved.</p>
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

type ChromeProps = LineupSlotEditorBodyProps & {
  confirmingClose: boolean;
  onRequestClose: () => void;
  onConfirmDiscardAndClose: () => void;
  onCancelClose: () => void;
};

export function LineupSlotInspector({ confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, ...body }: ChromeProps) {
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
      aria-label="Edit lineup"
      role="dialog"
      aria-modal="false"
      className="flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Edit lineup</p>
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

      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <LineupSlotEditorBody {...body} />}
    </aside>
  );
}

export function LineupSlotSheet({
  isOpen,
  confirmingClose,
  onRequestClose,
  onConfirmDiscardAndClose,
  onCancelClose,
  ...body
}: ChromeProps & { isOpen: boolean }) {
  return (
    <TouchlineBottomSheet isOpen={isOpen} onClose={onRequestClose} title="Edit lineup" description={`${body.slotLabel} slot — ${body.matchReference}`} tone="context" ariaLabel="Edit lineup">
      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <LineupSlotEditorBody {...body} />}
    </TouchlineBottomSheet>
  );
}
