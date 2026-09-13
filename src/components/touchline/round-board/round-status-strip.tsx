import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import type { RoundBoardSummary } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `RoundStatusStrip` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §4/§6`). Surfaces unresolved
 * decisions before routine allocations (contract's own exception-first requirement) — decisions
 * needing attention is the visually dominant tile, not just one of five equal tiles.
 */
export type RoundStatusStripProps = {
  summary: RoundBoardSummary;
  className?: string;
};

function Tile({ value, label, tone = "neutral" }: { value: string; label: string; tone?: "neutral" | "attention" | "positive" }) {
  const valueClass = tone === "attention" ? "text-[var(--warning)]" : tone === "positive" ? "text-[var(--accent-strong)]" : "text-[var(--foreground)]";
  return (
    <TouchlineWidget padding="compact" className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={`tl-evidence-number text-[22px] ${valueClass}`}>{value}</span>
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
    </TouchlineWidget>
  );
}

export function RoundStatusStrip({ summary, className }: RoundStatusStripProps) {
  const opportunityPct = summary.targetOpportunities > 0 ? Math.round((summary.plannedOpportunities / summary.targetOpportunities) * 100) : 0;

  return (
    <div className={`grid grid-cols-2 gap-3 medium:grid-cols-5 ${className ?? ""}`}>
      <Tile value={String(summary.decisions)} label="Decisions need attention" tone={summary.decisions > 0 ? "attention" : "positive"} />
      <Tile value={String(summary.matches)} label="Matches this round" />
      <Tile value={`${summary.plannedOpportunities} / ${summary.targetOpportunities}`} label={`Opportunities planned (${opportunityPct}%)`} />
      <Tile value={String(summary.coverageIssues)} label="Coverage issues" tone={summary.coverageIssues > 0 ? "attention" : "positive"} />
    </div>
  );
}
