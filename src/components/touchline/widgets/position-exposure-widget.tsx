import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { PitchExposure, type PitchExposureEntry } from "@/components/touchline/viz/pitch-exposure";

/**
 * PositionExposureWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Exact positions + minutes/share — a pitch exposure graphic + legend. Never infers ability from
 * exposure (see `docs/domain/touchline-atlas-provenance.md §2`).
 */
export type PositionExposureWidgetProps = {
  entries: PitchExposureEntry[];
  className?: string;
};

export function PositionExposureWidget({ entries, className }: PositionExposureWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Position exposure" title="Where minutes have come from" />
      <div className="mt-3">
        <PitchExposure question="Which positions has this player actually appeared in?" entries={entries} />
      </div>
    </TouchlineWidget>
  );
}
