import { Quote } from "lucide-react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";

/**
 * `PlayerObservationStory` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`) — the latest
 * observation/review. One of the few places authored prose gets visual weight (contract's own
 * instruction), matching the golden reference's "Latest review" card.
 */
export type PlayerObservationStoryProps = {
  observation: { note: string; createdAt: string; sourceLabel: string; themes: string[] } | null;
  className?: string;
};

export function PlayerObservationStory({ observation, className }: PlayerObservationStoryProps) {
  if (!observation) {
    return (
      <TouchlineWidget className={className}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Latest review</p>
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">No observation recorded yet.</p>
      </TouchlineWidget>
    );
  }

  return (
    <TouchlineWidget className={className}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Latest review</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {observation.sourceLabel} · {observation.createdAt}
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <p className="text-[15px] italic leading-relaxed text-[var(--foreground)]">{observation.note}</p>
      </div>
      {observation.themes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {observation.themes.map((theme, i) => (
            <span
              key={theme}
              className={
                i < 2
                  ? "rounded-full border border-[var(--accent)]/50 px-2 py-0.5 text-[11px] text-[var(--accent-strong)]"
                  : "rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
              }
            >
              {theme}
            </span>
          ))}
        </div>
      ) : null}
    </TouchlineWidget>
  );
}
