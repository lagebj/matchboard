import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import type { SeasonReviewDevelopmentData } from "@/lib/season/get-season-review-data";

/**
 * Season Review's Development tab (ADR-0157 slice C7, `09_SEASON_REVIEW.md` "Development tab").
 * Aggregates without ranking: ADR-0155 established/emerging trend counts, active development
 * focuses by category, development-cycle review outcomes, and unresolved next-focus themes. AI
 * content (`unresolvedNextFocus`, `developmentCycleReviews`) is visually distinct and labelled —
 * never the deterministic headline.
 *
 * "Coach-confirmed assessments" is deferred for this slice (disclosed in the PR): no existing
 * season-scoped read model surfaces promoted coach assessments without a per-player query loop,
 * and ADR-0157 names exactly that shape as a named regression risk for this surface.
 */
export function SeasonReviewDevelopment({ data }: { data: SeasonReviewDevelopmentData }) {
  const { trendRollup, activeDevelopmentFocusCount, developmentFocusByCategory, unresolvedNextFocus, developmentCycleReviews } = data;

  const hasAnything =
    trendRollup.playersWithEstablishedTrend > 0 ||
    trendRollup.playersWithEmergingSignal > 0 ||
    activeDevelopmentFocusCount > 0 ||
    unresolvedNextFocus.length > 0 ||
    developmentCycleReviews.length > 0;

  if (!hasAnything) {
    return (
      <EmptyState
        title="No development evidence yet"
        description="Development trends, active focuses, and cycle reviews appear here once enough evidence has been recorded this season."
        illustration="emptyStats"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface variant="default" padding="lg">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Positional breadth and development exposure</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          ADR-0155 trends read only from persisted derivation — never recomputed here. Established requires 6 eligible matches; emerging is still
          accumulating evidence.
        </p>
        <div className="mt-3 flex flex-wrap gap-5">
          <div className="flex flex-col">
            <span className="tl-sport text-lg font-[650] text-[var(--foreground)]">{trendRollup.playersWithEstablishedTrend}</span>
            <span className="text-[11px] text-[var(--text-muted)]">Players with an established trend</span>
          </div>
          <div className="flex flex-col">
            <span className="tl-sport text-lg font-[650] text-[var(--foreground)]">{trendRollup.playersWithEmergingSignal}</span>
            <span className="text-[11px] text-[var(--text-muted)]">Players with an emerging signal</span>
          </div>
        </div>
        {trendRollup.established.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {trendRollup.established.map((entry) => (
              <p key={`${entry.metricKey}-${entry.direction}`} className="text-xs text-[var(--text-soft)]">
                {entry.metricKey} · {entry.direction.toLowerCase()} · {entry.playerCount} player{entry.playerCount === 1 ? "" : "s"}
              </p>
            ))}
          </div>
        )}
      </Surface>

      {activeDevelopmentFocusCount > 0 && (
        <Surface variant="default" padding="lg">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Active development focuses</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{activeDevelopmentFocusCount} active development thread{activeDevelopmentFocusCount === 1 ? "" : "s"} across the squad.</p>
          <div className="mt-3 flex flex-col gap-1">
            {developmentFocusByCategory.map((entry) => (
              <div key={entry.category} className="flex items-center justify-between text-xs">
                <span className="text-[var(--foreground)]">{entry.label}</span>
                <span className="text-[var(--text-muted)]">{entry.count}</span>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {developmentCycleReviews.length > 0 && (
        <Surface variant="info" padding="lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--info)]">Assistant Coach hypothesis</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">Development-cycle review outcomes</h3>
          <div className="mt-3 flex flex-col gap-3">
            {developmentCycleReviews.map((review) => (
              <div key={review.teamId}>
                <p className="text-xs font-medium text-[var(--text-soft)]">
                  {review.teamName} · {review.windowLabel}
                </p>
                {review.summary && <p className="mt-1 text-xs text-[var(--text-muted)]">{review.summary}</p>}
              </div>
            ))}
          </div>
        </Surface>
      )}

      {unresolvedNextFocus.length > 0 && (
        <Surface variant="info" padding="lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--info)]">Assistant Coach hypothesis</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">Unresolved next-focus themes</h3>
          <div className="mt-3 flex flex-col gap-2">
            {unresolvedNextFocus.map((item, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-[var(--foreground)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}
