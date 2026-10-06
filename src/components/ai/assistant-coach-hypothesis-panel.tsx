"use client";

import { useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { TouchlineButton } from "@/components/touchline";
import { useOrgSlug } from "@/components/shell/org-slug-context";
import {
  confirmAssistantCoachHypothesisAction,
  dismissAssistantCoachHypothesisAction,
} from "@/app/(app)/o/[orgSlug]/players/[playerId]/assistant-coach-actions";
import type { EvidenceRef } from "@/lib/development-context/types";

/**
 * Assistant Coach hypothesis display (ADR-0155 step B7 / ADR-0157 slice C5 — the first UI for
 * this capability's hypotheses). Deliberately NOT built on `EvidenceStory`'s deterministic-
 * evidence grammar: a hypothesis is knowledge-hierarchy class 4 (ADR-0157 §2), never class 2, so
 * it gets its own visually distinct card with an explicit "Assistant Coach hypothesis" label,
 * cited evidence-reference counts, disclosed missing evidence, and a promote/dismiss action —
 * never silent canonical-state mutation (ADR-0157 §5).
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

export type AssistantCoachHypothesisViewModel = {
  id: string;
  statement: string;
  uncertainty: string;
  supportingRefs: EvidenceRef[];
  contradictingRefs: EvidenceRef[];
  missingEvidence: string[];
};

const MAX_FOCUS_LENGTH = 200;

export function AssistantCoachHypothesisPanel({
  hypotheses,
}: {
  hypotheses: AssistantCoachHypothesisViewModel[];
}) {
  if (hypotheses.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Assistant Coach hypotheses
      </p>
      {hypotheses.map((hypothesis) => (
        <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} />
      ))}
    </div>
  );
}

function HypothesisCard({ hypothesis }: { hypothesis: AssistantCoachHypothesisViewModel }) {
  const orgSlug = useOrgSlug();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"promoted" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState("");

  if (outcome) return null;

  return (
    <div className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <div className="flex items-center justify-between gap-2">
        <StatusPill size="sm" variant="development">
          Assistant Coach hypothesis
        </StatusPill>
        <span className="text-[11px] text-[var(--text-muted)]">
          {UNCERTAINTY_LABEL[hypothesis.uncertainty] ?? hypothesis.uncertainty}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--foreground)]">{hypothesis.statement}</p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {hypothesis.supportingRefs.length > 0
          ? `Supporting evidence: ${describeRefs(hypothesis.supportingRefs)}`
          : "No supporting evidence cited."}
        {hypothesis.contradictingRefs.length > 0 ? ` · Contradicting: ${describeRefs(hypothesis.contradictingRefs)}` : ""}
      </p>
      {hypothesis.missingEvidence.length > 0 ? (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Missing evidence: {hypothesis.missingEvidence.join(", ")}</p>
      ) : null}
      <p className="mt-2 text-[11px] italic text-[var(--text-muted)]">
        This is an AI hypothesis, not a confirmed fact. It never changes the player&apos;s record on its own.
      </p>
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[11px] font-medium text-[var(--text-muted)]" htmlFor={`assistant-coach-focus-${hypothesis.id}`}>
          Development focus to record if promoted
        </label>
        <input
          id={`assistant-coach-focus-${hypothesis.id}`}
          className="rounded-md border border-[var(--border-soft)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
          value={focus}
          maxLength={MAX_FOCUS_LENGTH}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="e.g. Composure receiving under pressure"
        />
        <div className="flex gap-2">
          <TouchlineButton
            variant="primary"
            size="sm"
            disabled={isPending || focus.trim().length === 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await confirmAssistantCoachHypothesisAction(orgSlug, hypothesis.id, focus);
                if (result.success) setOutcome("promoted");
                else setError(result.error);
              });
            }}
          >
            Promote to development focus
          </TouchlineButton>
          <TouchlineButton
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await dismissAssistantCoachHypothesisAction(orgSlug, hypothesis.id);
                if (result.success) setOutcome("dismissed");
                else setError(result.error);
              });
            }}
          >
            Dismiss
          </TouchlineButton>
        </div>
      </div>
    </div>
  );
}
