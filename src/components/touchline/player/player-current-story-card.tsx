import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import type { PlayerCurrentStory } from "@/lib/touchline/presentation/player-current-story";

/**
 * Player Detail Overview's `Current story` block (ADR-0157 slice C5). The page only renders this
 * component when `selectPlayerCurrentStory()` returned a non-null result — there is no internal
 * empty state here, matching the spec's own instruction to omit the block entirely rather than
 * fill the space with generic praise.
 */
export function PlayerCurrentStoryCard({ story, className }: { story: PlayerCurrentStory; className?: string }) {
  return (
    <TouchlineWidget className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current story</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--foreground)]">{story.text}</p>
    </TouchlineWidget>
  );
}
