import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TimelineStrip, type TimelineStripEntry } from "@/components/touchline/viz/timeline-strip";

/**
 * MovementHistoryWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Selection movements by period/player — a compact `TimelineStrip` plus a short recent-rows list.
 */
export type MovementHistoryRow = {
  id: string;
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  role: string;
  roundLabel: string;
};

export type MovementHistoryWidgetProps = {
  strip: TimelineStripEntry[];
  recentRows: MovementHistoryRow[];
  className?: string;
};

export function MovementHistoryWidget({ strip, recentRows, className }: MovementHistoryWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Movement" title="Recent movement" />
      <div className="mt-3">
        <TimelineStrip question="What movement has happened recently?" entries={strip} />
      </div>
      {recentRows.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
          {recentRows.map((r) => (
            <li key={r.id} className="text-[13px] text-[var(--text-soft)]">
              <span className="font-[600] text-[var(--foreground)]">{r.playerName}</span> · {r.fromTeamName} →{" "}
              {r.toTeamName} ({r.role}) · {r.roundLabel}
            </li>
          ))}
        </ul>
      ) : null}
    </TouchlineWidget>
  );
}
