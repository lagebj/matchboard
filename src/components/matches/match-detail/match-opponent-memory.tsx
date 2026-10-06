import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlineButton } from "@/components/touchline";
import type { OpponentMemoryViewModel } from "@/lib/matches/match-insights/opponent-memory-view-model";

/**
 * Opponent memory (ADR-0157 §6 "Match Preparation convergence" target order item 2, between
 * match identity and ranked Match Insights). Compact, deterministic — up to three recent
 * encounters and up to two recurring patterns already computed by `buildOpponentContext()`; this
 * component only renders, it derives nothing. Not a replacement for the full "Opponent context"
 * tab (`MatchOpponentContextPanel`), which still owns the complete W/D/L history and concern log.
 */
export function MatchOpponentMemory({
  opponentMemory,
  opponentTabHref,
}: {
  opponentMemory: OpponentMemoryViewModel | null;
  opponentTabHref: string;
}) {
  if (!opponentMemory || !opponentMemory.hasHistory) return null;

  const { recentEncounters, patterns } = opponentMemory;

  return (
    <TouchlineWidget>
      <WidgetHeader eyebrow="Opponent memory" title="What we know about this opponent" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Recent encounters</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[var(--text-default)]">
            {recentEncounters.map((e) => (
              <li key={e.matchId} className="flex items-baseline justify-between gap-3">
                <span>{e.resultLabel}</span>
                <span className="text-[12px] text-[var(--text-muted)]">
                  {e.occurredAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {patterns.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Recurring patterns</p>
            <ul className="mt-2 flex flex-col gap-2 text-[13px] text-[var(--text-default)]">
              {patterns.map((p) => (
                <li key={p.summary}>
                  <p>{p.summary}</p>
                  <p className="text-[12px] text-[var(--text-muted)]">{p.qualifier}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <TouchlineButton as={Link} href={opponentTabHref} variant="ghost" size="sm" className="mt-3">
        View full opponent context
      </TouchlineButton>
    </TouchlineWidget>
  );
}
