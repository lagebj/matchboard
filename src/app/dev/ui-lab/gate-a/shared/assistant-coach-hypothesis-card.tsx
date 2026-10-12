"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { TouchlineButton } from "@/components/touchline";
import type { EvidenceRef } from "@/lib/development-context/types";

/**
 * Gate A W4 dev-only pure-presentation candidate for the real `AssistantCoachHypothesisPanel`
 * (`src/components/ai/assistant-coach-hypothesis-panel.tsx`). That component is not
 * fixture-injectable as-is: its `HypothesisCard` hardcodes a `useOrgSlug()` context dependency
 * and calls the real `confirmAssistantCoachHypothesisAction`/`dismissAssistantCoachHypothesisAction`
 * server actions directly on click — see `docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md` W4-BLK-10.
 * This candidate reproduces its exact visual grammar and types (same `StatusPill`/`TouchlineButton`
 * primitives, same uncertainty/evidence-ref/missing-evidence vocabulary, same "never changes the
 * player's record on its own" disclosure) with injected `onPromote`/`onDismiss` callbacks instead
 * of a live mutation — the same "isolated reusable presentation candidate, not a production
 * refactor" pattern W1 established for BLK-01/02/03.
 */

const UNCERTAINTY_LABEL: Record<string, string> = {
  LOW: "Low uncertainty",
  MEDIUM: "Medium uncertainty",
  HIGH: "High uncertainty",
};

const EVIDENCE_REF_KIND_LABEL: Record<string, string> = {
  MATCH_EVENT: "match event",
  ACTUAL_POSITION_INTERVAL: "actual position record",
  QUALITATIVE_OBSERVATION: "coach observation",
  HUMAN_ASSESSMENT: "coach assessment",
  MATCH_CONTEXT: "match context",
  DERIVED_MEASUREMENT: "derived measurement",
  DERIVED_TREND: "derived trend",
};

function describeRefs(refs: EvidenceRef[]): string {
  return refs.map((ref) => ref.label ?? EVIDENCE_REF_KIND_LABEL[ref.kind] ?? ref.kind).join(", ");
}

export type AssistantCoachHypothesisCardViewModel = {
  id: string;
  statement: string;
  uncertainty: "LOW" | "MEDIUM" | "HIGH";
  supportingRefs: EvidenceRef[];
  contradictingRefs: EvidenceRef[];
  missingEvidence: string[];
};

export type AssistantCoachHypothesisOutcome = "PROMOTED" | "DISMISSED" | null;

/**
 * Same "return null -> no reserved gap" contract as the real panel (A08's own acceptance
 * question: "no reserved gap when off"). Callers decide whether to render this at all; it never
 * renders an empty shell itself.
 */
export function AssistantCoachHypothesisCard({
  hypothesis,
  outcome,
  onPromote,
  onDismiss,
}: {
  hypothesis: AssistantCoachHypothesisCardViewModel;
  outcome: AssistantCoachHypothesisOutcome;
  onPromote: (focus: string) => void;
  onDismiss: () => void;
}) {
  const [focus, setFocus] = useState("");

  if (outcome) {
    return (
      <div
        role="status"
        className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4"
      >
        <p className="text-[13px] font-[700] text-[var(--foreground)]">
          {outcome === "PROMOTED" ? "Promoted to development focus (simulated)" : "Dismissed (simulated)"}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">No server called. Production authorization not verified.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4" data-testid="assistant-coach-hypothesis-card">
      <div className="flex items-center justify-between gap-2">
        <StatusPill size="sm" variant="development">
          Assistant Coach hypothesis
        </StatusPill>
        <span className="text-[11px] text-[var(--text-muted)]">{UNCERTAINTY_LABEL[hypothesis.uncertainty] ?? hypothesis.uncertainty}</span>
      </div>
      <p className="mt-2 text-sm text-[var(--foreground)]">{hypothesis.statement}</p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {hypothesis.supportingRefs.length > 0 ? `Supporting evidence: ${describeRefs(hypothesis.supportingRefs)}` : "No supporting evidence cited."}
        {hypothesis.contradictingRefs.length > 0 ? ` · Contradicting: ${describeRefs(hypothesis.contradictingRefs)}` : ""}
      </p>
      {hypothesis.missingEvidence.length > 0 ? (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Missing evidence: {hypothesis.missingEvidence.join(", ")}</p>
      ) : null}
      <p className="mt-2 text-[11px] italic text-[var(--text-muted)]">
        This is an AI hypothesis, not a confirmed fact. It never changes the player&apos;s record on its own.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[11px] font-medium text-[var(--text-muted)]" htmlFor={`w4-assistant-coach-focus-${hypothesis.id}`}>
          Development focus to record if promoted
        </label>
        <input
          id={`w4-assistant-coach-focus-${hypothesis.id}`}
          className="rounded-md border border-[var(--border-soft)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
          value={focus}
          maxLength={200}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="e.g. Composure receiving under pressure"
        />
        <div className="flex gap-2">
          <TouchlineButton variant="primary" size="sm" disabled={focus.trim().length === 0} onClick={() => onPromote(focus)}>
            Promote to development focus
          </TouchlineButton>
          <TouchlineButton variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </TouchlineButton>
        </div>
      </div>
    </div>
  );
}

/** A08's "no filler when on-but-empty" state: an explicit, honest, non-alarming quiet message —
 * never a blank region, never a fabricated placeholder hypothesis. */
export function AssistantCoachNoPatternNotice() {
  return (
    <p data-testid="assistant-coach-no-pattern" className="text-[13px] text-[var(--text-muted)]">
      Assistant Coach has no useful pattern to report for this player right now.
    </p>
  );
}

/** A05/A08 "unavailable" state: restrained, honest, never a large infrastructure banner — same
 * register as `MatchInsights`'s own `AI_UNAVAILABLE` status line. */
export function AssistantCoachUnavailableNotice() {
  return (
    <p data-testid="assistant-coach-unavailable" className="text-[13px] text-[var(--text-muted)]">
      Assistant Coach is temporarily unavailable. Deterministic information below is still current.
    </p>
  );
}
