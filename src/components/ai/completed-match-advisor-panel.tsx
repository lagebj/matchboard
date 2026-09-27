"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { TouchlineButton } from "@/components/touchline";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrgSlug } from "@/components/shell/org-slug-context";
import {
  confirmAiDevelopmentSuggestionAction,
  dismissAiInsightAction,
  answerAiInsightClarificationAction,
} from "@/app/(app)/o/[orgSlug]/matches/[matchId]/ai-insight-actions";
import {
  VISIBLE_INSIGHT_COUNT,
  type AdvisorClarificationViewModel,
  type AdvisorInsightViewModel,
  type CompletedMatchAdvisorViewModel,
  type DevelopmentSuggestionViewModel,
} from "@/lib/ai/presentation/completed-match-advisor";

/**
 * Completed-match "AI Advisor" panel (ADR-0152 §16, 08_UI_UX_SPEC.md "Completed match"): Summary
 * first, then Supported/Contradicted/Still unresolved/Unexpected/Next focus insights (first
 * `VISIBLE_INSIGHT_COUNT` shown, "Show all" for the rest — empty sections are simply absent from
 * `viewModel.insights`, nothing to hide), then at most one Clarify card, then development
 * suggestions — the only place an AI Advisor insight can become canonical Matchboard data, and
 * only via explicit coach action (01_LOCKED_DECISIONS.md #15). No "Player of the Match" concept.
 */
export function CompletedMatchAdvisorPanel({
  viewModel,
}: {
  viewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }>;
}) {
  const orgSlug = useOrgSlug();
  return (
    <Surface padding="md">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--success-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">
          AI Advisor
        </span>
        <span className="text-sm font-semibold">Post-match review</span>
      </div>
      {viewModel.status === "stale" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Based on an earlier version of this report</p>
      )}
      {viewModel.summary && <p className="mt-3 text-sm text-[var(--text-muted)]">{viewModel.summary}</p>}
      {viewModel.insights.length > 0 && <AdvisorInsightList insights={viewModel.insights} />}
      {viewModel.clarification && <ClarifyCard orgSlug={orgSlug} clarification={viewModel.clarification} />}
      {viewModel.suggestions.map((suggestion) => (
        <DevelopmentSuggestionCard key={suggestion.insightId} orgSlug={orgSlug} suggestion={suggestion} />
      ))}
      <p className="mt-3 text-xs text-[var(--text-muted)]">Generated from submitted report</p>
    </Surface>
  );
}

function AdvisorInsightList({ insights }: { insights: AdvisorInsightViewModel[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? insights : insights.slice(0, VISIBLE_INSIGHT_COUNT);

  let lastSectionLabel: string | null = null;
  return (
    <div className="mt-4 divide-y divide-[var(--border-soft)]">
      {visible.map((insight, index) => {
        const showHeader = insight.sectionLabel !== lastSectionLabel;
        lastSectionLabel = insight.sectionLabel;
        return (
          <div key={index} className="py-3 first:pt-0 last:pb-0">
            {showHeader && (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {insight.sectionLabel}
              </p>
            )}
            <div className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{insight.body}</p>
                {insight.evidenceSources.length > 0 && (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{insight.evidenceSources.join(" · ")}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {!showAll && insights.length > VISIBLE_INSIGHT_COUNT && (
        <div className="pt-3">
          <TouchlineButton variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            Show all ({insights.length})
          </TouchlineButton>
        </div>
      )}
    </div>
  );
}

function ClarifyCard({ orgSlug, clarification }: { orgSlug: string; clarification: AdvisorClarificationViewModel }) {
  const [isPending, startTransition] = useTransition();
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (answered) return null;

  return (
    <div className="mt-4 rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <StatusPill size="sm" variant="development">
        Clarify
      </StatusPill>
      <p className="mt-3 text-sm font-semibold">{clarification.question}</p>
      {clarification.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {clarification.options.map((option) => (
            <TouchlineButton
              key={option}
              type="button"
              variant={selectedOption === option ? "primary" : "secondary"}
              size="sm"
              disabled={isPending}
              onClick={() => setSelectedOption(option)}
            >
              {option}
            </TouchlineButton>
          ))}
        </div>
      )}
      <textarea
        className="mt-3 w-full rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-2 text-sm"
        rows={2}
        placeholder="Or answer in your own words"
        value={answerText}
        disabled={isPending}
        onChange={(e) => setAnswerText(e.target.value)}
      />
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      <div className="mt-3">
        <TouchlineButton
          variant="primary"
          size="sm"
          disabled={isPending || (!selectedOption && !answerText.trim())}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await answerAiInsightClarificationAction(orgSlug, clarification.insightId, {
                selectedOption: selectedOption ?? undefined,
                answerText: answerText.trim() || undefined,
              });
              if (result.success) setAnswered(true);
              else setError(result.error);
            });
          }}
        >
          Submit
        </TouchlineButton>
      </div>
    </div>
  );
}

function DevelopmentSuggestionCard({ orgSlug, suggestion }: { orgSlug: string; suggestion: DevelopmentSuggestionViewModel }) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"confirmed" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (outcome) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <StatusPill size="sm" variant="development">
        Development suggestion
      </StatusPill>
      <p className="mt-3 text-sm font-semibold">{suggestion.title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{suggestion.body}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">This is a suggestion only.</p>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <TouchlineButton
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await confirmAiDevelopmentSuggestionAction(orgSlug, suggestion.insightId);
              if (result.success) setOutcome("confirmed");
              else setError(result.error);
            });
          }}
        >
          Confirm as development observation
        </TouchlineButton>
        <TouchlineButton
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await dismissAiInsightAction(orgSlug, suggestion.insightId);
              if (result.success) setOutcome("dismissed");
              else setError(result.error);
            });
          }}
        >
          Dismiss
        </TouchlineButton>
      </div>
    </div>
  );
}
