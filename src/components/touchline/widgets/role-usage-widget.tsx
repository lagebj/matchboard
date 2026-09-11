import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { RoleDistribution, type RoleDistributionCounts } from "@/components/touchline/viz/role-distribution";

/**
 * RoleUsageWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Selection role usage (core/support/development/squad repair) as a stacked distribution.
 */
export type RoleUsageWidgetProps = {
  counts: RoleDistributionCounts;
  className?: string;
};

export function RoleUsageWidget({ counts, className }: RoleUsageWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Role usage" title="Core vs. movement" />
      <div className="mt-3">
        <RoleDistribution question="How is selection role usage distributed?" counts={counts} />
      </div>
    </TouchlineWidget>
  );
}
