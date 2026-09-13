import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import type { PlayerPositionTimelineEntry } from "@/lib/touchline/presentation/player-matches-view-model";

/**
 * `PlayerPositionTimeline` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §5`) — a compact
 * position timeline, shown "where data is strong enough" (contract's own qualifier: rendered as
 * an explicit empty state below the threshold, never a fabricated strip).
 */
export type PlayerPositionTimelineProps = {
  entries: PlayerPositionTimelineEntry[];
  className?: string;
};

const MIN_ENTRIES_FOR_TIMELINE = 3;

export function PlayerPositionTimeline({ entries, className }: PlayerPositionTimelineProps) {
  if (entries.length < MIN_ENTRIES_FOR_TIMELINE) {
    return (
      <TouchlineWidget className={className}>
        <WidgetHeader eyebrow="Position timeline" title="Not enough recorded matches yet" />
      </TouchlineWidget>
    );
  }

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Position timeline" title="Actual position by match" />
      <div className="mt-3 flex items-end gap-2 overflow-x-auto">
        {entries.map((e, i) => (
          <div key={`${e.matchLabel}-${i}`} className="flex flex-col items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--tl-c-surface-strong)] text-[11px] font-[700] text-[var(--foreground)]">
              {e.position}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{e.matchLabel}</span>
          </div>
        ))}
      </div>
    </TouchlineWidget>
  );
}
