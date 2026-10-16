"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { TouchlineBottomSheet } from "@/components/touchline/overlay/touchline-bottom-sheet";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { FixtureOperationOutcome, FixtureOperationStatus } from "../../shared/fixture-operation";
import type { LineupProposalEvidenceSource, LineupSlotAssignmentProposal } from "./lineup-proposal-contract";

/**
 * A10 "Review lineup alternative" editor — same desktop-inspector/mobile-sheet chrome pattern as
 * A07's `lineup-slot-editor.tsx` (XR-I01: stays in Match Details), but the body is a structured,
 * CONTRACT-VALIDATED Assistant Coach proposal (`lineup-proposal-contract.ts`), never an
 * unstructured candidate row. A07's own `LineupSlotEditorBody` is deliberately NOT reused here —
 * see this module's prior doc comment for why (unchanged rationale; independent review preserved
 * it).
 *
 * Operation-control policy is centralized here, not scattered across individually-inconsistent
 * button conditions (independent review finding): exactly one `OperationControlPolicy` derivation
 * decides whether select/apply/discard are each available, so a future change to PENDING/applied
 * semantics cannot silently diverge between controls again.
 *
 * Second review round: evidence inspection (`EvidenceSourceList`) is a sibling of, never nested
 * inside, the candidate-selection button (finding N2 — a `<details>` inside a `<button>` is
 * invalid interactive HTML and could toggle selection on expand/collapse). The diff preview
 * identifies the actual proposed player, not just "draft, not yet applied" (finding N3).
 */
export type { LineupSlotAssignmentProposal };

export type LineupProposalSuccess = { assignedPlayerId: string; slotLabel: string };

/** `null` when staleness/unavailability means there is nothing eligible to review at all. */
export type ProposalBlockedReason = { kind: "STALE"; message: string } | { kind: "UNAVAILABLE"; message: string };

export type LineupProposalEditorBodyProps = {
  matchReference: string;
  slotLabel: string;
  pitchSlots: PlanningPitchSlot[];
  pitchAssignments: PlanningPitchAssignment[];
  proposal: LineupSlotAssignmentProposal | null;
  /** Display-only view-model fields — never read for validation; the contract validates by
   * `playerId`, not by a display string. */
  candidateDisplayName: string;
  candidateShirtNumber: number;
  evidence: readonly LineupProposalEvidenceSource[];
  blockedReason: ProposalBlockedReason | null;
  isDraftSelected: boolean;
  onSelectCandidate: () => void;
  status: FixtureOperationStatus;
  outcome: FixtureOperationOutcome<LineupProposalSuccess> | null;
  onConfirm: () => void;
  onResolvePending: () => void;
  onDiscardDraft: () => void;
};

/**
 * One centralized derivation of what each control may do right now — "already applied" is read
 * directly from the authoritative pitch projection (`currentSlotAssignment`), never a
 * component-local `wasApplied` boolean, so it stays correct across close/reopen without any extra
 * state to keep in sync (independent review finding: a local boolean reset on close let an
 * already-applied proposal look freshly actionable again).
 */
function deriveOperationControlPolicy(status: FixtureOperationStatus, proposalPlayerId: string | undefined, currentSlotPlayerId: string | undefined | null) {
  const isPending = status === "PENDING";
  const appliedAlready = !isPending && proposalPlayerId !== undefined && currentSlotPlayerId === proposalPlayerId;
  return {
    isPending,
    appliedAlready,
    canSelect: !isPending && !appliedAlready,
    canDiscard: status === "IDLE" && !appliedAlready,
    canApply: !isPending && !appliedAlready,
  };
}

function EvidenceSourceList({ evidence }: { evidence: readonly LineupProposalEvidenceSource[] }) {
  const KIND_LABEL: Record<LineupProposalEvidenceSource["kind"], string> = {
    RECORDED_MATCH: "Recorded match fact",
    COACH_DECLARED: "Coach-declared",
    DEVELOPMENT_EVIDENCE: "Development evidence",
    DETERMINISTIC_DERIVATION: "Deterministic derivation",
  };
  const COVERAGE_LABEL: Record<LineupProposalEvidenceSource["coverage"], string> = {
    COMPLETE: "Complete",
    PARTIAL: "Partial",
    NOT_RECORDED: "Not recorded",
    UNKNOWN: "Unknown",
    NOT_APPLICABLE: "Not applicable",
  };
  return (
    <details className="mt-1 text-[11px] text-[var(--text-muted)]" data-testid="proposal-evidence-inspector">
      <summary className="cursor-pointer select-none">
        Based on {evidence.length} cited source{evidence.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-1 flex flex-col gap-1.5 pl-3">
        {evidence.map((source) => (
          <li key={source.sourceId} data-testid="proposal-evidence-source" className="border-l border-[var(--border-soft)] pl-2">
            <p className="text-[11px] font-[600] text-[var(--text-soft)]">
              {KIND_LABEL[source.kind]} · {COVERAGE_LABEL[source.coverage]}
            </p>
            <p>
              {source.fieldLabel}: {source.fieldValue}
            </p>
            <p className="italic">Supports: {source.supports}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function LineupProposalEditorBody({
  matchReference,
  slotLabel,
  pitchSlots,
  pitchAssignments,
  proposal,
  candidateDisplayName,
  candidateShirtNumber,
  evidence,
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
  const policy = deriveOperationControlPolicy(status, proposal?.playerId, currentSlotAssignment?.playerId ?? null);
  const displayName = currentSlotAssignment?.name;

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
          {/* A stale (but structurally valid) proposal stays inspectable — only genuinely
              unavailable/malformed proposals have nothing left to show
              (`06_STRUCTURED_PROPOSAL_AND_OPERATION_CONTRACT.md`: "the coach may still inspect
              the original recommendation, but applying it must be blocked"). */}
          {proposal ? (
            <>
              <p className="mt-3 text-[12px] text-[var(--foreground)]">
                {candidateDisplayName} · №{candidateShirtNumber}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{proposal.rationale}</p>
              <EvidenceSourceList evidence={evidence} />
            </>
          ) : null}
        </div>
      ) : null}

      {proposal && policy.appliedAlready ? (
        <div role="status" data-testid="proposal-already-applied" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/50 p-3">
          <p className="text-[13px] font-[700] text-[var(--foreground)]">Already applied (simulated)</p>
          <p className="mt-0.5 text-[12px] text-[var(--foreground)]">
            {displayName} is now assigned to {slotLabel}. This proposal is no longer actionable.
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">{proposal.rationale}</p>
          <EvidenceSourceList evidence={evidence} />
        </div>
      ) : null}

      {proposal && !blockedReason && !policy.appliedAlready ? (
        <div data-testid="lineup-proposal-card">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Assistant Coach proposal</p>
          {/* Second review round finding N2: evidence inspection must never live inside the
              selection button — a <details>/<summary> nested in a <button> is invalid interactive
              HTML, and opening/closing it could toggle the parent's onClick too. Candidate
              identity, rationale, limitations, and the evidence inspector are now a plain
              non-interactive info block; "Select proposal" is its own separate, sibling button. */}
          <div
            data-testid="lineup-proposal-info"
            className={cn("rounded-lg border p-3", isDraftSelected ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-soft)]")}
          >
            <p className="text-[13px] font-[600] text-[var(--foreground)]">
              {candidateDisplayName} · №{candidateShirtNumber}
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
            <EvidenceSourceList evidence={evidence} />
            <button
              type="button"
              data-testid="lineup-proposal-row"
              onClick={onSelectCandidate}
              disabled={!policy.canSelect}
              aria-pressed={isDraftSelected}
              className="mt-3 w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[13px] font-[600] text-[var(--foreground)] disabled:opacity-50"
            >
              {isDraftSelected ? "Selected ✓" : "Select proposal"}
            </button>
          </div>

          {isDraftSelected ? (
            <div data-testid="lineup-diff-preview" className="mt-3 rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
              <p>
                <span className="font-[650]">{slotLabel}:</span> {currentSlotAssignment ? currentSlotAssignment.name : "Empty"} → {candidateDisplayName}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Draft, not yet applied.</p>
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

      {proposal && !blockedReason && !policy.appliedAlready ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isDraftSelected || !policy.canApply}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)] disabled:opacity-50"
          >
            Apply proposal
          </button>
          {isDraftSelected && policy.canDiscard ? (
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
  className?: string;
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

export function LineupProposalInspector({ confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, className, ...body }: ChromeProps) {
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
      className={cn("flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]", className)}
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

export function LineupProposalSheet({ isOpen, confirmingClose, onRequestClose, onConfirmDiscardAndClose, onCancelClose, className: _className, ...body }: ChromeProps & { isOpen: boolean }) {
  return (
    <TouchlineBottomSheet isOpen={isOpen} onClose={onRequestClose} title="Review lineup" description={`${body.slotLabel} slot — ${body.matchReference}`} tone="context" ariaLabel="Review lineup">
      {confirmingClose ? <DiscardConfirmPrompt onConfirm={onConfirmDiscardAndClose} onCancel={onCancelClose} /> : <LineupProposalEditorBody {...body} />}
    </TouchlineBottomSheet>
  );
}
