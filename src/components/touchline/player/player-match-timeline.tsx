import Link from "next/link";
import { Target, Footprints } from "lucide-react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import type { PlayerMatchRow } from "@/lib/touchline/presentation/player-matches-view-model";

/**
 * `PlayerMatchTimeline` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §5`, Matches tab). Dense
 * match rows with real actual data — minutes, actual positions, core/support/development context,
 * goals/assists. Never infers a position from a planned lineup when actual data exists (contract's
 * own rule for this tab) — a match with no `actualPositions` simply shows none, it is not
 * backfilled from a plan.
 */
export type PlayerMatchTimelineProps = {
  matches: PlayerMatchRow[];
  className?: string;
};

const CONTEXT_LABEL: Record<NonNullable<PlayerMatchRow["context"]>, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
};

export function PlayerMatchTimeline({ matches, className }: PlayerMatchTimelineProps) {
  return (
    <TouchlineWidget className={className}>
      <ul className="flex flex-col divide-y divide-[var(--border-soft)]">
        {matches.map((m) => (
          <li key={m.matchId} className="py-3">
            <Link href={m.href} className="flex flex-col gap-1 no-underline">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[14px] font-[600] text-[var(--foreground)]">{m.opponentOrEventName}</p>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{m.date}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-soft)]">
                <span className="text-[var(--text-muted)]">{m.competitionLabel}</span>
                {m.context ? <span>{CONTEXT_LABEL[m.context]}</span> : null}
                {m.minutes != null ? <span>{m.minutes}&apos;</span> : null}
                {m.actualPositions.length > 0 ? <span>{m.actualPositions.join(" → ")}</span> : <span className="text-[var(--text-muted)]">No actual position recorded</span>}
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
            </Link>
          </li>
        ))}
        {matches.length === 0 ? <li className="py-3 text-[12px] text-[var(--text-muted)]">No matches recorded for this scope.</li> : null}
      </ul>
    </TouchlineWidget>
  );
}
