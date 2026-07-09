"use client";

import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { getPlayerAttributeAverages } from "@/lib/player-metrics";

type AttributeAverages = ReturnType<typeof getPlayerAttributeAverages>;

type CategorySummary = {
  label: string;
  average: number | null;
  ratedCount: number;
  totalKeys: readonly string[];
  player: Record<string, number | null>;
};

function getCategorySummaries(player: Record<string, number | null>, averages: AttributeAverages): CategorySummary[] {
  return [
    { label: "Technical", average: averages.technical, ratedCount: countRated(player, ["ballControl", "passing", "firstTouch", "oneVOneAttacking"]), totalKeys: ["ballControl", "passing", "firstTouch", "oneVOneAttacking"], player },
    { label: "Tactical", average: averages.tactical, ratedCount: countRated(player, ["positioning", "oneVOneDefending", "decisionMaking"]), totalKeys: ["positioning", "oneVOneDefending", "decisionMaking"], player },
    { label: "Mental", average: averages.mental, ratedCount: countRated(player, ["effort", "teamplay", "concentration"]), totalKeys: ["effort", "teamplay", "concentration"], player },
    { label: "Physical", average: averages.physical, ratedCount: countRated(player, ["speed", "strength"]), totalKeys: ["speed", "strength"], player },
  ];
}

function countRated(player: Record<string, number | null>, keys: readonly string[]): number {
  return keys.filter((k) => player[k] != null).length;
}

function getStrongestAndWeakest(summaries: CategorySummary[]): { strongest: string | null; weakest: string | null } {
  const rated = summaries.filter((s) => s.average !== null);
  if (rated.length === 0) return { strongest: null, weakest: null };

  const sorted = [...rated].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  return {
    strongest: sorted[0].label,
    weakest: sorted[sorted.length - 1].label,
  };
}

type PlayerWithAttributes = {
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
};

type PlayerReportSummaryPanelProps = {
  player: PlayerWithAttributes;
};

export function PlayerReportSummaryPanel({ player }: PlayerReportSummaryPanelProps) {
  const averages = getPlayerAttributeAverages(player);
  const summaries = getCategorySummaries(player as unknown as Record<string, number | null>, averages);
  const { strongest, weakest } = getStrongestAndWeakest(summaries);
  const hasAnyRatings = averages.overall !== null;

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Attribute summary" />
      {!hasAnyRatings ? (
        <p className="mt-1.5 text-[11px] text-[var(--text-soft)]">No attributes rated yet.</p>
      ) : (
        <div className="mt-1.5">
          <div className="grid grid-cols-4 gap-2">
            {summaries.map((cat) => (
              <div key={cat.label} className="flex flex-col items-center gap-px">
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{cat.label}</span>
                <span className="text-base font-semibold tabular-nums text-zinc-100 leading-tight">
                  {cat.average !== null ? cat.average.toFixed(1) : "—"}
                </span>
                <span className="text-[9px] text-zinc-500">{cat.ratedCount}/{cat.totalKeys.length}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3 border-t border-[var(--border-soft)] pt-1.5 text-[11px]">
            {strongest && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">Strongest</span>
                <span className="text-emerald-400 font-medium">{strongest}</span>
              </div>
            )}
            {weakest && weakest !== strongest && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">Needs coaching</span>
                <span className="text-amber-400 font-medium">{weakest}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </TacticalSurface>
  );
}