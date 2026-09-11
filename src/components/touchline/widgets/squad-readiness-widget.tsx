import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { CapacityBar } from "@/components/touchline/widget/capacity-bar";

/**
 * SquadReadinessWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Available/doubtful/unavailable counts (or event squad target readiness), a compact
 * counts/distribution visual, and names only for actionable exceptions (not the whole roster).
 */
export type SquadReadinessException = {
  playerId: string;
  displayName: string;
  reason: string;
};

export type SquadReadinessWidgetProps = {
  title?: string;
  available: number;
  doubtful: number;
  unavailable: number;
  exceptions: SquadReadinessException[];
  /** Present only for the event-squad-target variant; omit for the plain availability variant. */
  capacity?: { value: number; max: number };
  viewAllHref?: string;
  className?: string;
};

export function SquadReadinessWidget({
  title,
  available,
  doubtful,
  unavailable,
  exceptions,
  capacity,
  viewAllHref,
  className,
}: SquadReadinessWidgetProps) {
  const items: MetricStripItem[] = [
    { id: "available", label: "Available", value: String(available), tone: "accent" },
    { id: "doubtful", label: "Doubtful", value: String(doubtful), tone: "attention" },
    { id: "unavailable", label: "Unavailable", value: String(unavailable), tone: "danger" },
  ];

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader
        eyebrow="Squad status"
        title={title ?? `${available} available`}
        action={viewAllHref ? <Link href={viewAllHref} className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</Link> : undefined}
      />
      <div className="mt-3">
        <MetricStrip items={items} />
      </div>
      {capacity ? (
        <div className="mt-3">
          <CapacityBar value={capacity.value} max={capacity.max} />
        </div>
      ) : null}
      {exceptions.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
          {exceptions.map((e) => (
            <li key={e.playerId} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-[var(--text-soft)]">{e.displayName}</span>
              <span className="text-[var(--text-muted)]">{e.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </TouchlineWidget>
  );
}
