"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { TouchlineButton } from "@/components/touchline";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrgSlug } from "@/components/shell/org-slug-context";
import { confirmAiDevelopmentSuggestionAction, dismissAiInsightAction } from "@/app/(app)/o/[orgSlug]/matches/[matchId]/ai-insight-actions";
import type { CompletedMatchAdvisorViewModel, DevelopmentSuggestionViewModel } from "@/lib/ai/presentation/completed-match-advisor";

/**
 * Completed-match "AI Advisor" panel (08_UI_UX_SPEC.md "Completed match"): plain observation
 * insights render the same way as the planned-match panel, but a development-suggestion insight
 * gets its own card with `Confirm as development observation`/`Dismiss` actions — the only place
 * in the product where an AI Advisor insight can become canonical Matchboard data, and only via
 * explicit coach action (01_LOCKED_DECISIONS.md #15). No "Player of the Match" concept.
 */
export function CompletedMatchAdvisorPanel({
  viewModel,
}: {
  viewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" }>;
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
      {viewModel.insights.length > 0 && (
        <div className="mt-4 divide-y divide-[var(--border-soft)]">
          {viewModel.insights.map((insight, index) => (
            <div key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{insight.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewModel.suggestions.map((suggestion) => (
        <DevelopmentSuggestionCard key={suggestion.insightId} orgSlug={orgSlug} suggestion={suggestion} />
      ))}
      <p className="mt-3 text-xs text-[var(--text-muted)]">Generated from submitted report</p>
    </Surface>
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
