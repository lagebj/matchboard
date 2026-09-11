import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { ScorebookMatchRow } from "@/components/touchline/scorebook/scorebook-match-row";
import type { MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * RecentFootballWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Recent canonical matches as dense `ScorebookMatchRow`s — never a card-per-match. Outcome stays
 * neutral (weight, not colour) per the existing scorebook grammar.
 */
export type RecentFootballWidgetProps = {
  matches: MatchPresentation[];
  viewAllHref?: string;
  className?: string;
};

export function RecentFootballWidget({ matches, viewAllHref, className }: RecentFootballWidgetProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader
        title="Latest matches"
        action={viewAllHref ? <Link href={viewAllHref} className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</Link> : undefined}
      />
      {matches.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">No completed matches yet.</p>
      ) : (
        <div className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {matches.map((m) => (
            <ScorebookMatchRow key={m.id} presentation={m} />
          ))}
        </div>
      )}
    </TouchlineWidget>
  );
}
