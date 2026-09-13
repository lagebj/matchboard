import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";

/**
 * `PlayerParticipationStrip` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`). One composed
 * horizontal strip — matches, minutes, starts, goals, assists. Never five separate cards
 * (contract's own explicit instruction).
 */
export type PlayerParticipationStripProps = {
  matches: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  className?: string;
};

function Column({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <span className="tl-evidence-number text-[var(--foreground)]">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

export function PlayerParticipationStrip({ matches, minutes, starts, goals, assists, className }: PlayerParticipationStripProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Participation" title="This season" />
      <div className="mt-3 flex items-stretch gap-1">
        <Column value={matches} label="Matches" />
        <Column value={minutes} label="Minutes" />
        <Column value={starts} label="Starts" />
        <Column value={goals} label="Goals" />
        <Column value={assists} label="Assists" />
      </div>
    </TouchlineWidget>
  );
}
