import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";
import type { MatchInsightCandidate, MatchInsightCategory, MatchInsightRelevance } from "@/lib/matches/match-insights/types";

/**
 * One Match Insights card (ADR-0149; bundle §4 "Insight anatomy"). The coach does not need to
 * know which insight was deterministic and which used AI to connect evidence (bundle §2) — both
 * render identically here; only the expandable provenance line at the bottom distinguishes them,
 * and only internal database ids/raw evidence-ref strings are withheld, never the fact that AI
 * was involved.
 */

const CATEGORY_LABEL: Record<MatchInsightCategory, string> = {
  OPPONENT_HISTORY: "Opponent history",
  CURRENT_PLAN: "Current plan",
  COMBINATION: "Combination",
  POSITION: "Position",
  PLAYER_PROFILE: "Player profile",
  OPPORTUNITY: "Opportunity",
  DEVELOPMENT: "Development",
  TEAM_PATTERN: "Team pattern",
  OBSERVATION_FOCUS: "Worth observing",
};

const RELEVANCE_VARIANT: Record<MatchInsightRelevance, StatusPillVariant> = {
  HIGH: "warning",
  MEDIUM: "info",
  CONTEXTUAL: "neutral",
};

const RELEVANCE_LABEL: Record<MatchInsightRelevance, string> = {
  HIGH: "High relevance",
  MEDIUM: "Relevant",
  CONTEXTUAL: "Contextual",
};

export function MatchInsightCard({ insight }: { insight: MatchInsightCandidate }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill variant={RELEVANCE_VARIANT[insight.relevance]} size="sm">
          {RELEVANCE_LABEL[insight.relevance]}
        </StatusPill>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {CATEGORY_LABEL[insight.category]}
        </span>
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)]">{insight.title}</p>
      <p className="text-sm text-[var(--text-muted)]">{insight.observation}</p>
      {insight.implication && (
        <p className="text-xs italic text-[var(--text-soft)]">{insight.implication}</p>
      )}
      <details className="mt-1 text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Evidence</summary>
        <div className="mt-1 flex flex-col gap-0.5 pl-3">
          {insight.confidence && <span>Confidence: {insight.confidence.toLowerCase()}</span>}
          <span>
            Based on {insight.evidenceRefs.length} recorded fact{insight.evidenceRefs.length === 1 ? "" : "s"}.
          </span>
          <span>{insight.source === "AI" ? "AI interpretation of recorded Matchboard data." : "Factual, from Matchboard's own records."}</span>
        </div>
      </details>
    </div>
  );
}
