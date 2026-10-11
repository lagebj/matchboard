"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { TouchlineBottomSheet } from "@/components/touchline/overlay/touchline-bottom-sheet";
import type { FixtureOperationOutcome, FixtureOperationStatus } from "../../shared/fixture-operation";

/**
 * A09 shared desktop-inspector / mobile-sheet Today quick-action editor (bundle
 * `03_INTERACTION_AND_POLICY_CONTRACT.md` "A09 Today"). Same body/chrome split as A07's
 * `lineup-slot-editor.tsx` and Round Board's `PlayerAssignmentInspector`/`Sheet` pair — one body,
 * two responsive wrappers, never two divergent implementations.
 *
 * `countLabel`/`actionLabel` let one shared component honestly distinguish a normal planned-
 * selection addition from the separate `MATCH_DAY_ADDITION` operational path (A09-S6) — the label
 * changes, the underlying body/state-machine contract does not (`17_CONTEXT_LOCAL_INTERACTION_
 * CONTRACT.md` "Today / match quick action").
 */
export type TodayQuickActionCandidate = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  eligible: boolean;
  reasons: string[];
};

export type TodayQuickActionSuccess = { addedPlayerId: string };

export type TodayQuickActionBodyProps = {
  matchReference: string;
  dateLabel: string;
  roundLabel: string;
  countLabel: string;
  currentCount: number;
  targetCount: number | null;
  actionLabel: string;
  candidate: TodayQuickActionCandidate;
  isDraftSelected: boolean;
  onSelectCandidate: () => void;
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<TodayQuickActionSuccess> | null;
  onConfirm: () => void;
  onResolvePending: () => void;
  onDiscardDraft: () => void;
};

export function TodayQuickActionBody({
  matchReference,
  dateLabel,
  roundLabel,
  countLabel,
  currentCount,
  targetCount,
  actionLabel,
  candidate,
  isDraftSelected,
  onSelectCandidate,
  status,
  outcome,
  onConfirm,
  onResolvePending,
  onDiscardDraft,
}: TodayQuickActionBodyProps) {
  // `currentCount` is the caller's `useFixtureOperation` authoritative count — it is ALREADY the
  // post-increment value once `status === "SUCCESS"` (the hook's own `applySuccess` reducer did
  // that). This component must never add its own second `+1` on top of that, or a saved count
  // would silently double-increment. Only the still-unsaved PREVIEW line below computes its own
  // `currentCount + 1`, since that one draft value genuinely has not been applied yet.
  const previewCount = isDraftSelected && status !== "SUCCESS" ? currentCount + 1 : currentCount;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] text-[var(--text-muted)]">
          {matchReference} · {dateLabel} · {roundLabel}
        </p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]" data-testid="today-count">
          {countLabel}: {currentCount}
          {targetCount !== null ? ` / ${targetCount}` : ""}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Candidate</p>
        <button
          type="button"
          data-testid="today-candidate-row"
          onClick={onSelectCandidate}
          disabled={!candidate.eligible || status === "PENDING" || status === "SUCCESS"}
          aria-pressed={isDraftSelected}
          aria-disabled={!candidate.eligible}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left disabled:opacity-60",
            isDraftSelected ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-soft)]",
          )}
        >
          <div>
            <p className="text-[13px] font-[600] text-[var(--foreground)]">
              {candidate.displayName}
              {candidate.shirtNumber !== null ? ` · №${candidate.shirtNumber}` : ""}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {candidate.reasons.map((r) => (
                <li key={r} className="text-[11px] text-[var(--text-soft)]">
                  {candidate.eligible ? "✓" : "✕"} {r}
                </li>
              ))}
            </ul>
          </div>
          {candidate.eligible ? (
            <span aria-hidden="true" className="text-[11px] text-[var(--text-muted)]">
              {isDraftSelected ? "Selected ✓" : "Select"}
            </span>
          ) : null}
        </button>
      </div>

      {isDraftSelected ? (
        <p data-testid="today-diff-preview" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
          <span className="font-[650]">{countLabel}:</span> {currentCount}
          {targetCount !== null ? `/${targetCount}` : ""} → {previewCount}
          {targetCount !== null ? `/${targetCount}` : ""} — draft, not yet saved.
        </p>
      ) : null}

      <TodayStatusBanner status={status} outcome={outcome} onResolvePending={onResolvePending} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!isDraftSelected || status === "PENDING" || status === "SUCCESS"}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)] disabled:opacity-50"
        >
          {actionLabel}
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

function TodayStatusBanner({
  status,
  outcome,
  onResolvePending,
}: {
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<TodayQuickActionSuccess> | null;
  onResolvePending: () => void;
}) {
  if (status === "PENDING") {
    return (
      <div role="status" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[600] text-[var(--foreground)]">Saving… (fixture simulation)</p>
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
  if (status === "PERMISSION_DENIED" && outcome?.kind === "PERMISSION_DENIED") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] p-3">
        <p className="text-[13px] font-[700] text-[var(--danger)]">Permission denied</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.reason}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">No write occurred.</p>
      </div>
    );
  }
  if (status === "CONFLICT" && outcome?.kind === "CONFLICT") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] p-3">
        <p className="text-[13px] font-[700] text-[var(--warning)]">Already a participant — recheck match</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.currentSummary}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Expected revision {outcome.expectedRevision}, current revision {outcome.currentRevision}. No duplicate add, no auto-merge. Use "Discard draft" below to recheck.
        </p>
      </div>
    );
  }
  if (status === "PLANNING_CLOSED" && outcome?.kind === "PLANNING_CLOSED") {
    return (
      <div role="alert" className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)]/50 p-3">
        <p className="text-[13px] font-[700] text-[var(--foreground)]">Planning is closed for this match</p>
        <p className="mt-0.5 text-[12px] text-[var(--foreground)]">{outcome.reason}</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">No save is possible. The planned-selection count is unchanged. Draft preserved for inspection only.</p>
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
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Your draft selection has not been saved.</p>
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

type ChromeProps = TodayQuickActionBodyProps & {
  confirmingClose: boolean;
  onRequestClose: () => void;
  onConfirmDiscardAndClose: () => void;
  onCancelClose: () => void;
};

export function TodayQuickActionInspector({ confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, ...body }: ChromeProps) {
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
      aria-label={body.actionLabel}
      role="dialog"
      aria-modal="false"
      className="flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Today</p>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--foreground)]">{body.actionLabel}</p>
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

      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <TodayQuickActionBody {...body} />}
    </aside>
  );
}

export function TodayQuickActionSheet({
  isOpen,
  confirmingClose,
  onRequestClose,
  onConfirmDiscardAndClose,
  onCancelClose,
  ...body
}: ChromeProps & { isOpen: boolean }) {
  return (
    <TouchlineBottomSheet isOpen={isOpen} onClose={onRequestClose} title={body.actionLabel} description={`${body.matchReference} · ${body.dateLabel}`} tone="context" ariaLabel={body.actionLabel}>
      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <TodayQuickActionBody {...body} />}
    </TouchlineBottomSheet>
  );
}
