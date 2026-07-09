import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MATCH_CATEGORY_LABELS, type PlayerCategoryStats } from "@/lib/stats/match-category";

type PlayerStatsSummaryTableProps = {
  stats: {
    actualAppearances: number;
    goals: number;
    assists: number;
    plannedButAbsent: number;
  };
  categoryStats?: PlayerCategoryStats | null;
};

export function PlayerStatsSummaryTable({
  stats,
  categoryStats,
}: PlayerStatsSummaryTableProps) {
  const hasAnyData = stats.actualAppearances > 0 || stats.goals > 0 || stats.assists > 0;
  const hasCategoryData = categoryStats && (
    categoryStats.league.appearances > 0 ||
    categoryStats.cup.appearances > 0 ||
    categoryStats.other.appearances > 0
  );

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Statistics" />
      {!hasAnyData && !hasCategoryData ? (
        <p className="mt-2 text-sm text-[var(--text-soft)]">No match statistics yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-left py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Competition</th>
                <th className="text-right py-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Apps</th>
                <th className="text-right py-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Goals</th>
                <th className="text-right py-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Assists</th>
              </tr>
            </thead>
            <tbody>
              {hasCategoryData && categoryStats && (
                <>
                  {([categoryStats.league, categoryStats.cup, categoryStats.other] as const).map((line) => (
                    <tr key={line.category} className="border-b border-[var(--border-soft)]/50">
                      <td className="py-1.5 pr-3 text-zinc-200 font-medium">{MATCH_CATEGORY_LABELS[line.category]}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-zinc-200">{line.appearances}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-zinc-200">{line.goals}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-zinc-200">{line.assists}</td>
                    </tr>
                  ))}
                </>
              )}
              <tr className="font-semibold">
                <td className="py-1.5 pr-3 text-zinc-100">Total</td>
                <td className="text-right py-1.5 px-2 tabular-nums text-zinc-100">
                  {hasCategoryData && categoryStats
                    ? categoryStats.total.appearances
                    : stats.actualAppearances}
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums text-zinc-100">
                  {hasCategoryData && categoryStats
                    ? categoryStats.total.goals
                    : stats.goals}
                </td>
                <td className="text-right py-1.5 px-2 tabular-nums text-zinc-100">
                  {hasCategoryData && categoryStats
                    ? categoryStats.total.assists
                    : stats.assists}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </TacticalSurface>
  );
}