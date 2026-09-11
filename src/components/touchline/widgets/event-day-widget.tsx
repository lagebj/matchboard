import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlineTimeline, TimelineItem, type TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";

/**
 * EventDayWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Event timeline, now/next/later. Entries are real `EventMatch` rows only — no fictional
 * meeting/warm-up/lunch schedule items (see `docs/domain/touchline-atlas-provenance.md §0.13`).
 */
export type EventDayItem = {
  id: string;
  timeLabel: string;
  title: string;
  sublabel?: string;
  state: TimelineNodeState;
  href?: string;
};

export type EventDayWidgetProps = {
  items: EventDayItem[];
  className?: string;
};

export function EventDayWidget({ items, className }: EventDayWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Event day" title="Today's matches" />
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">No matches scheduled today.</p>
      ) : (
        <div className="mt-2">
          <TouchlineTimeline aria-label="Event day">
            {items.map((item, i) => (
              <TimelineItem key={item.id} timeLabel={item.timeLabel} state={item.state} isLast={i === items.length - 1}>
                <p className="text-[15px] font-[600] text-[var(--foreground)]">{item.title}</p>
                {item.sublabel ? <p className="text-[13px] text-[var(--text-muted)]">{item.sublabel}</p> : null}
              </TimelineItem>
            ))}
          </TouchlineTimeline>
        </div>
      )}
    </TouchlineWidget>
  );
}
