import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import type { SeasonReviewStory } from "@/lib/season/season-review-view-model";

/**
 * Season Review's Overview tab (ADR-0157 slice C7). Story-first: renders only the stories
 * `buildSeasonReviewViewModel()` selected as materially eligible -- never a matrix, never a
 * config control, never an equal-card metric-dashboard wall. A story's own "Explore evidence"
 * link is the only navigation into the richer drill-down tabs.
 */
export function SeasonReviewOverview({ stories }: { stories: SeasonReviewStory[] }) {
  if (stories.length === 0) {
    return (
      <EmptyState
        title="No evidence-backed stories yet"
        description="Stories appear once this league season has enough finalised selection, movement, trend, or development evidence to say something materially different from the expected state."
        illustration="emptyStats"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stories.map((story) => (
        <Surface key={story.family} variant="default" padding="lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Season story</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">{story.title}</h3>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{story.evidenceStatement}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{story.coverageNote}</p>
          {story.supportingVisual && (
            <div className="mt-3 flex flex-wrap gap-5">
              {story.supportingVisual.parts.map((part) => (
                <div key={part.label} className="flex flex-col">
                  <span className="tl-sport text-lg font-[650] text-[var(--foreground)]">{part.value}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{part.label}</span>
                </div>
              ))}
            </div>
          )}
          <Link
            href={story.exploreHref}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-strong)] no-underline hover:brightness-110"
          >
            Explore evidence <span aria-hidden="true">›</span>
          </Link>
        </Surface>
      ))}
    </div>
  );
}
