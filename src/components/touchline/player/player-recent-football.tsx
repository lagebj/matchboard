import Link from "next/link";
import { ChevronRight, Target, Footprints } from "lucide-react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import type { PlayerRecentMatchRow } from "@/lib/touchline/presentation/player-overview-view-model";

/**
 * `PlayerRecentFootball` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`). Dense sports
 * rows — date, opponent/event, result where applicable, minutes, actual position(s), goal/assist
 * where canonical. No card around every match (contract's own explicit instruction) — one
 * enclosing widget, thin dividers between rows.
 */
export type PlayerRecentFootballProps = {
  matches: PlayerRecentMatchRow[];
  viewAllHref?: string;
  className?: string;
};

function DateStack({ date }: { date: string }) {
  const [day, month] = date.split(" ");
  return (
    <div className="flex w-9 shrink-0 flex-col items-center leading-none">
      <span className="text-[16px] font-[700] text-[var(--foreground)]">{day}</span>
      <span className="text-[10px] uppercase text-[var(--text-muted)]">{month}</span>
    </div>
  );
}

export function PlayerRecentFootball({ matches, viewAllHref, className }: PlayerRecentFootballProps) {
  return (
    <TouchlineWidget className={className}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Recent football</p>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-[12px] font-medium text-[var(--accent)] no-underline hover:underline">
            View all <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
        {matches.map((m) => (
          <li key={m.matchId}>
            <Link href={m.href} className="flex items-center gap-3 py-2.5 no-underline">
              <DateStack date={m.matchDate} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-[600] text-[var(--foreground)]">{m.opponent}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{m.role ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-soft)]">
                {m.goals > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Target className="h-3.5 w-3.5" aria-hidden="true" /> {m.goals}
                  </span>
                ) : null}
                {m.assists > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Footprints className="h-3.5 w-3.5" aria-hidden="true" /> {m.assists}
                  </span>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {matches.length === 0 ? <li className="py-2.5 text-[12px] text-[var(--text-muted)]">No recent matches recorded.</li> : null}
      </ul>
    </TouchlineWidget>
  );
}
