import { StackedDistribution } from "./stacked-distribution";

/**
 * RoleDistribution (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * The specific "Core / Support / Development / Squad repair" role-usage case of
 * `StackedDistribution` — a named wrapper so callers don't re-derive the fixed role order/labels
 * themselves. Domain role counts only (`SelectionRole`-derived), never a position/exposure value.
 */
export type RoleDistributionCounts = {
  core: number;
  support: number;
  development: number;
  squadRepair: number;
};

export function RoleDistribution({
  question,
  counts,
  className,
}: {
  question: string;
  counts: RoleDistributionCounts;
  className?: string;
}) {
  return (
    <StackedDistribution
      question={question}
      className={className}
      segments={[
        { label: "Core", value: counts.core },
        { label: "Support", value: counts.support },
        { label: "Development", value: counts.development },
        { label: "Squad repair", value: counts.squadRepair },
      ]}
    />
  );
}
