import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { Sparkline } from "@/components/touchline/viz/sparkline";

/**
 * OpportunityWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Weekly opportunity status/history — a Sparkline over recent eligible rounds plus a factual,
 * non-causal, non-shaming interpretation sentence (see
 * `src/lib/touchline/presentation/player-detail-view-model.ts`'s `describeOpportunityTrend`).
 */
export type OpportunityWidgetProps = {
  ratioLabel: string;
  sparkline: number[];
  periodLabels: string[];
  trendLabel: string;
  className?: string;
};

export function OpportunityWidget({ ratioLabel, sparkline, periodLabels, trendLabel, className }: OpportunityWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Opportunity" title={`${ratioLabel} this week`} />
      <div className="mt-3">
        <Sparkline question="How has planned opportunity changed recently?" values={sparkline} periodLabels={periodLabels} />
      </div>
      <p className="mt-3 text-[13px] text-[var(--text-soft)]">{trendLabel}</p>
    </TouchlineWidget>
  );
}
