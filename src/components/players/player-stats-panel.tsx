import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { Users, Target, Crosshair, ShieldHalf, TrendingUp } from "lucide-react";
import { MATCH_CATEGORY_LABELS, type CategoryStatLine, type PlayerCategoryStats } from "@/lib/stats/match-category";

type PlayerStatsPanelProps = {
  selectionStatus: {
    total: number;
    draft: number;
    finalized: number;
    floating: number;
  };
  finalizedHistory: {
    core: number;
    support: number;
    development: number;
    lastMatch: string | null;
  };
  stats: {
    actualAppearances: number;
    goals: number;
    assists: number;
    plannedButAbsent: number;
  };
  categoryStats?: PlayerCategoryStats | null;
};

export function PlayerStatsPanel({
  selectionStatus,
  finalizedHistory,
  stats,
  categoryStats,
}: PlayerStatsPanelProps) {
  const hasStats = stats.actualAppearances > 0 || stats.goals > 0 || stats.assists > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Selection status */}
      <TacticalSurface variant="default" padding="md">
        <SectionHeader title="Selection status" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MetricTile icon={<Users className="h-3.5 w-3.5" />} label="Total" value={selectionStatus.total} />
          <MetricTile label="Draft" value={selectionStatus.draft} tone="warning" />
          <MetricTile label="Finalized" value={selectionStatus.finalized} tone="success" />
          <MetricTile label="Floating" value={selectionStatus.floating} />
        </div>
      </TacticalSurface>

      {/* Finalized history */}
      <TacticalSurface variant="default" padding="md">
        <SectionHeader title="Finalized history" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MetricTile label="Core" value={finalizedHistory.core} />
          <MetricTile label="Support" value={finalizedHistory.support} />
          <MetricTile label="Dev" value={finalizedHistory.development} />
        </div>
        {finalizedHistory.lastMatch && (
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">
            Last: {finalizedHistory.lastMatch}
          </p>
        )}
      </TacticalSurface>

      {/* Match stats */}
      {hasStats && (
        <TacticalSurface variant="default" padding="md">
          <SectionHeader title="Match stats" />
          <p className="text-[10px] text-[var(--text-muted)]">From reported matches</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MetricTile icon={<Target className="h-3.5 w-3.5" />} label="Appearances" value={stats.actualAppearances} />
            <MetricTile icon={<Crosshair className="h-3.5 w-3.5" />} label="Goals" value={stats.goals} />
            <MetricTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Assists" value={stats.assists} />
            <MetricTile icon={<ShieldHalf className="h-3.5 w-3.5" />} label="Absent" value={stats.plannedButAbsent} />
          </div>
        </TacticalSurface>
      )}

      {/* Category breakdown */}
      {categoryStats && (categoryStats.cup.appearances > 0 || categoryStats.other.appearances > 0) && (
        <TacticalSurface variant="default" padding="md">
          <SectionHeader title="By category" />
          <div className="mt-2 space-y-2">
            {([categoryStats.league, categoryStats.cup, categoryStats.other] as const).map((line: CategoryStatLine) => (
              <div key={line.category} className="grid grid-cols-4 gap-2 text-xs">
                <span className="font-medium text-zinc-200">{MATCH_CATEGORY_LABELS[line.category]}</span>
                <span className="text-[var(--text-muted)]">{line.appearances} app</span>
                <span className="text-[var(--text-muted)]">{line.goals} G</span>
                <span className="text-[var(--text-muted)]">{line.assists} A</span>
              </div>
            ))}
          </div>
        </TacticalSurface>
      )}
    </div>
  );
}