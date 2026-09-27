"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusText, TouchlineButton } from "@/components/touchline";
import { DEBRIEF_SCHEMA_VERSION, EMPTY_DEBRIEF_ANSWERS, isDebriefReadyToSubmit, safeParseDebriefAnswers, type DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { DEBRIEF_STEPS, DEBRIEF_STEP_LABELS, REQUIRED_DEBRIEF_STEPS, computeInitialStep, countReviewedRequiredSections, isStepComplete, type DebriefStep } from "@/lib/post-match/debrief/steps";
import { TeamExecutionStep, ThemeSelectionStep, MatchChangesStep, OpponentMemoryStep, PlayerObservationsStep, AnythingElseStep } from "./debrief-steps-ui";
import { DebriefReadOnly } from "./debrief-read-only";
import type { DebriefActionResult } from "@/app/(app)/matches/[matchId]/post-match/debrief-actions";

/**
 * Guided post-match debrief — the single required qualitative capture flow for a normal draft
 * report (ADR-0152 §3, bundle §5/§12). One component for League and Event alike; only the
 * server-action module and the id it closes over differ, matching `DebriefReportRef`.
 */
export type PostMatchDebriefRef = { kind: "LEAGUE"; matchId: string } | { kind: "EVENT"; eventMatchId: string };

type PlayerOption = { id: string; name: string };

type Actions = {
  save: (id: string, debriefId: string, answers: unknown) => Promise<DebriefActionResult>;
  submit: (id: string, debriefId: string) => Promise<DebriefActionResult>;
};

async function loadActions(kind: "LEAGUE" | "EVENT"): Promise<Actions> {
  if (kind === "LEAGUE") {
    const mod = await import("@/app/(app)/matches/[matchId]/post-match/debrief-actions");
    return { save: mod.saveDebriefDraftAction, submit: mod.submitDebriefAction };
  }
  const mod = await import("@/app/(app)/events/event-debrief-actions");
  return { save: mod.saveEventDebriefDraftAction, submit: mod.submitEventDebriefAction };
}

const SAVE_DEBOUNCE_MS = 600;

export function PostMatchDebrief({
  reportRef,
  debriefId,
  status: initialStatus,
  initialAnswers,
  opponentName,
  matchupLabel,
  playerOptions,
  periodOptions,
  readOnly = false,
}: {
  reportRef: PostMatchDebriefRef;
  debriefId: string;
  status: "DRAFT" | "SUBMITTED";
  initialAnswers: unknown;
  opponentName: string;
  matchupLabel: string;
  playerOptions: PlayerOption[];
  periodOptions: string[];
  readOnly?: boolean;
}) {
  const parsed = useMemo(() => {
    const result = safeParseDebriefAnswers(initialAnswers);
    return result.success ? result.data.answers : EMPTY_DEBRIEF_ANSWERS.answers;
  }, [initialAnswers]);

  const [status, setStatus] = useState(initialStatus);
  const [answers, setAnswers] = useState<DebriefAnswersSection>(parsed);
  const [step, setStep] = useState<DebriefStep>(() => computeInitialStep(parsed));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastSavedRef = useRef(JSON.stringify(parsed));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refId = reportRef.kind === "LEAGUE" ? reportRef.matchId : reportRef.eventMatchId;

  // Bundle §7 auto-save — local state updates immediately; persistence follows 600ms after the
  // coach stops typing/selecting. Preserves unsaved input on a save failure (state is never
  // rolled back here) and never calls a provider on save.
  useEffect(() => {
    if (status !== "DRAFT" || readOnly) return;
    const serialized = JSON.stringify(answers);
    if (serialized === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaveState("saving");
      loadActions(reportRef.kind)
        .then(({ save }) => save(refId, debriefId, { version: DEBRIEF_SCHEMA_VERSION, answers }))
        .then((result) => {
          if (result.success) {
            lastSavedRef.current = serialized;
            setSaveState("saved");
          } else {
            setSaveState("error");
          }
        })
        .catch(() => setSaveState("error"));
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Deliberately keyed only on `answers` — `reportRef`/`debriefId`/`status`/`readOnly` are
    // stable for the lifetime of one debrief and re-running this on their identity would just
    // re-debounce the same save.
  }, [answers]);

  if (readOnly || status === "SUBMITTED") {
    return (
      <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--text-muted)]">Post-match debrief</div>
            <div className="text-sm font-medium text-[var(--foreground)]">{matchupLabel}</div>
          </div>
          <StatusText tone="accent" dot>
            Submitted
          </StatusText>
        </div>
        <DebriefReadOnly answers={answers} opponentName={opponentName} />
      </div>
    );
  }

  const stepIndex = DEBRIEF_STEPS.indexOf(step);
  const reviewedCount = countReviewedRequiredSections(answers);
  const progressPercent = Math.round(((stepIndex + 1) / DEBRIEF_STEPS.length) * 100);
  const canContinue = isStepComplete(step, answers);

  function goBack() {
    if (stepIndex === 0) return;
    setStep(DEBRIEF_STEPS[stepIndex - 1]);
  }

  function goContinue() {
    if (!canContinue || stepIndex === DEBRIEF_STEPS.length - 1) return;
    setStep(DEBRIEF_STEPS[stepIndex + 1]);
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!isDebriefReadyToSubmit(answers)) {
      setStep(computeInitialStep(answers));
      setSubmitError("Review the highlighted debrief questions before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { submit } = await loadActions(reportRef.kind);
      const result = await submit(refId, debriefId);
      if (result.success) {
        setStatus("SUBMITTED");
      } else {
        setSubmitError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
      <header className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--text-muted)]">Post-match debrief</div>
            <div className="text-sm font-medium text-[var(--foreground)]">{matchupLabel}</div>
          </div>
          <StatusText tone="attention" dot>
            Draft
          </StatusText>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--tl-c-surface-selected)]">
          <div className="h-1.5 rounded-full bg-[var(--tl-c-accent)] transition-[width]" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {reviewedCount} of {REQUIRED_DEBRIEF_STEPS.length} required sections reviewed
        </div>
      </header>

      <h3 className="mb-4 text-[15px] font-semibold text-[var(--foreground)]">{DEBRIEF_STEP_LABELS[step]}</h3>

      <div className="mb-6">{renderStep(step, answers, setAnswers, { opponentName, playerOptions, periodOptions })}</div>

      {step === "review" && submitError && (
        <div className="mb-4 rounded-md border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] p-3">
          <p className="text-[13px] text-[var(--danger)]">{submitError}</p>
        </div>
      )}

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border-soft)] bg-[var(--tl-c-surface)] pt-3">
        <span className="text-xs text-[var(--text-muted)]">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved automatically"}
          {saveState === "error" && "Could not save. Retry."}
        </span>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <TouchlineButton variant="ghost" size="lg" onClick={goBack}>
              Back
            </TouchlineButton>
          )}
          {step === "review" ? (
            <TouchlineButton variant="primary" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit debrief"}
            </TouchlineButton>
          ) : (
            <TouchlineButton variant="primary" size="lg" onClick={goContinue} disabled={!canContinue}>
              Continue
            </TouchlineButton>
          )}
        </div>
      </div>
    </div>
  );
}

function renderStep(
  step: DebriefStep,
  answers: DebriefAnswersSection,
  setAnswers: (updater: (prev: DebriefAnswersSection) => DebriefAnswersSection) => void,
  context: { opponentName: string; playerOptions: PlayerOption[]; periodOptions: string[] },
) {
  switch (step) {
    case "team_execution":
      return <TeamExecutionStep value={answers.team_execution} onChange={(next) => setAnswers((prev) => ({ ...prev, team_execution: next }))} />;
    case "worked":
      return <ThemeSelectionStep value={answers.worked} onChange={(next) => setAnswers((prev) => ({ ...prev, worked: next }))} commentLabel="What did you see?" />;
    case "needs_attention":
      return <ThemeSelectionStep value={answers.needs_attention} onChange={(next) => setAnswers((prev) => ({ ...prev, needs_attention: next }))} commentLabel="What caused the problem?" />;
    case "match_changes":
      return <MatchChangesStep value={answers.match_changes} onChange={(next) => setAnswers((prev) => ({ ...prev, match_changes: next }))} periodOptions={context.periodOptions} />;
    case "opponent_memory":
      return <OpponentMemoryStep value={answers.opponent_memory} onChange={(next) => setAnswers((prev) => ({ ...prev, opponent_memory: next }))} opponentName={context.opponentName} />;
    case "player_observations":
      return <PlayerObservationsStep value={answers.player_observations} onChange={(next) => setAnswers((prev) => ({ ...prev, player_observations: next }))} playerOptions={context.playerOptions} />;
    case "anything_else":
      return <AnythingElseStep value={answers.anything_else} onChange={(next) => setAnswers((prev) => ({ ...prev, anything_else: next }))} />;
    case "review":
      return <DebriefReadOnly answers={answers} opponentName={context.opponentName} />;
  }
}
