import { TrendingUp, TrendingDown, ArrowRightLeft, BarChart3 } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

type FairnessMetric = {
  label: string;
  value: string | number;
  detail?: string;
  trend?: "up" | "down" | "neutral";
};

type FairnessSummaryProps = {
  metrics: FairnessMetric[];
  movementSummary?: {
    supportSent: number;
    supportReceived: number;
    developmentSent: number;
    developmentReceived: number;
    squadRepairReceived: number;
    drops: number;
  };
};

function MetricRow({ metric }: { metric: FairnessMetric }) {
  const trendIcon = {
    up: { icon: TrendingUp, className: "text-[var(--accent-strong)]" },
    down: { icon: TrendingDown, className: "text-[var(--warning)]" },
    neutral: { icon: BarChart3, className: "text-[var(--text-muted)]" },
  }[metric.trend ?? "neutral"];
  const Icon = trendIcon.icon;

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-[var(--text-soft)]">{metric.label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-zinc-100 tabular-nums">{metric.value}</span>
        {metric.trend && metric.trend !== "neutral" && (
          <Icon className={`h-3 w-3 ${trendIcon.className}`} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function MovementStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-medium tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}

export function FairnessSummary({ metrics, movementSummary }: FairnessSummaryProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader title="Fairness checks" description="How load and rotation balance across the round." />

      {metrics.length > 0 && (
        <Surface padding="sm">
          {metrics.map((m, i) => (
            <MetricRow key={i} metric={m} />
          ))}
        </Surface>
      )}

      {movementSummary && (
        <Surface padding="sm">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--text-soft)]">Movement this round</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <MovementStat label="Support sent" value={movementSummary.supportSent} />
            <MovementStat label="Support received" value={movementSummary.supportReceived} />
            <MovementStat label="Development sent" value={movementSummary.developmentSent} />
            <MovementStat label="Development received" value={movementSummary.developmentReceived} />
            <MovementStat label="Squad repair received" value={movementSummary.squadRepairReceived} />
            <MovementStat label="Dropped" value={movementSummary.drops} />
          </div>
        </Surface>
      )}
    </div>
  );
}
