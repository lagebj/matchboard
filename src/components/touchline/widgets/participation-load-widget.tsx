import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MiniBars, type MiniBarsSegment } from "@/components/touchline/viz/mini-bars";

/**
 * ParticipationLoadWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Finalised/actual appearance distribution — a range/bars visual with median/context, never
 * ranking language (no "most", no player-vs-player comparison framing).
 */
export type ParticipationLoadWidgetProps = {
  distribution: MiniBarsSegment[]; // e.g. appearance-count buckets
  loadRange: { min: number; median: number; max: number } | null;
  className?: string;
};

export function ParticipationLoadWidget({ distribution, loadRange, className }: ParticipationLoadWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Participation" title="Appearance distribution" />
      <div className="mt-3">
        <MiniBars question="How many players fall into each appearance-count band?" segments={distribution} />
      </div>
      {loadRange ? (
        <p className="mt-3 text-[13px] text-[var(--text-soft)]">
          Range {loadRange.min}–{loadRange.max} appearances · median {loadRange.median}
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">Not enough finalized data yet.</p>
      )}
    </TouchlineWidget>
  );
}
