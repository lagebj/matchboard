"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";
import { MatchInsightCard } from "./match-insight-card";
import type { MatchInsightsStatus, MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";

/**
 * Match Insights (ADR-0149) — the single pre-match decision-support surface. Replaces both
 * Partnership Evidence and the standalone AI Advisor panel on the before-match Overview tab.
 *
 * Deterministic insights are always current; only the AI-enrichment slice's availability changes
 * with `status` (04_FINGERPRINT_JOBS_AND_FAILURES.md §9-11) -- a restrained status line, never a
 * large infrastructure error banner in the coaching workspace.
 */

const DEFAULT_VISIBLE_COUNT = 5;

const STATUS_MESSAGE: Record<MatchInsightsStatus, string | null> = {
  CURRENT: null,
  UPDATING: "Updating insights…",
  STALE_AI_WITHHELD: "Updating insights…",
  AI_UNAVAILABLE: "AI interpretation is temporarily unavailable. Factual insights are still current.",
};

export function MatchInsights({ viewModel }: { viewModel: MatchInsightsViewModel | null }) {
  const [showAll, setShowAll] = useState(false);

  if (!viewModel) {
    return (
      <Surface padding="md">
        <SectionHeader title="Match Insights" description="What's useful to know when planning this match." />
        <p className="mt-3 text-xs text-[var(--text-muted)]">Loading…</p>
      </Surface>
    );
  }

  const { status, insights, totalCount } = viewModel;
  const statusMessage = STATUS_MESSAGE[status];
  const visible = showAll ? insights : insights.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMore = totalCount > DEFAULT_VISIBLE_COUNT;

  return (
    <Surface padding="md">
      <SectionHeader title="Match Insights" description="What's useful to know when planning this match." />
      {statusMessage && <p className="mt-2 text-xs text-[var(--text-muted)]">{statusMessage}</p>}

      {totalCount === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No major exceptions in the current plan.</p>
      ) : (
        <>
          <div className="mt-3 divide-y divide-[var(--border-soft)]">
            {visible.map((insight) => (
              <MatchInsightCard key={insight.id} insight={insight} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-3">
              <TouchlineButton variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `Show all (${totalCount})`}
              </TouchlineButton>
            </div>
          )}
        </>
      )}
    </Surface>
  );
}
