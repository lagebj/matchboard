import { TrendingUp, TrendingDown, ArrowRightLeft, BarChart3 } from "lucide-react";

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
    backfillReceived: number;
    drops: number;
  };
};

function MetricRow({ metric }: { metric: FairnessMetric }) {
  const trendIcon = {
    up: { icon: TrendingUp, className: "text-emerald-400" },
    down: { icon: TrendingDown, className: "text-amber-400" },
    neutral: { icon: BarChart3, className: "text-zinc-400" },
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

export function FairnessSummary({ metrics, movementSummary }: FairnessSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-zinc-100">Fairness checks</h3>
      </div>

      {metrics.length > 0 && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2">
          {metrics.map((m, i) => (
            <MetricRow key={i} metric={m} />
          ))}
        </div>
      )}

      {movementSummary && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="text-xs font-medium text-zinc-300">Movement this round</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <MovementStat label="Support sent" value={movementSummary.supportSent} />
            <MovementStat label="Support received" value={movementSummary.supportReceived} />
            <MovementStat label="Development sent" value={movementSummary.developmentSent} />
            <MovementStat label="Development received" value={movementSummary.developmentReceived} />
            <MovementStat label="Backfill received" value={movementSummary.backfillReceived} />
            <MovementStat label="Dropped" value={movementSummary.drops} />
          </div>
        </div>
      )}
    </div>
  );
}

function MovementStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-medium tabular-nums text-zinc-200">{value}</span>
    </div>
  );
}