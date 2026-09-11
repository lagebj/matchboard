import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlineTimeline, TimelineItem, type TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";

/**
 * ScheduleWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Chronological known football events/matches as compact timeline rows — reuses the existing
 * `TouchlineTimeline`/`TimelineItem` grammar, never a second timeline implementation.
 */
export type ScheduleWidgetItem = {
  id: string;
  timeLabel: string | null;
  title: string;
  sublabel?: string;
  state: TimelineNodeState;
};

export type ScheduleWidgetProps = {
  items: ScheduleWidgetItem[];
  viewAllHref?: string;
  className?: string;
};

export function ScheduleWidget({ items, viewAllHref, className }: ScheduleWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader
        title="Schedule"
        action={viewAllHref ? <Link href={viewAllHref} className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</Link> : undefined}
      />
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">Nothing scheduled.</p>
      ) : (
        <div className="mt-2">
          <TouchlineTimeline aria-label="Schedule">
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
