import Link from "next/link";
import { cn } from "@/lib/cn";
import { LeagueOperationalMatchRow } from "./league-operational-match-row";
import type { LeagueFocusedRound as LeagueFocusedRoundModel } from "@/lib/touchline/presentation/league-view-model";

/**
 * LeagueFocusedRound — League Operating Surface (`06_COMPONENT_COMPOSITION_CONTRACT.md
 * §"Focused round anatomy"`).
 *
 * Heading (round title), status badge (always "Current round" for a temporally current round —
 * attention only ever shows in the summary clause, never replacing the badge), one summary line,
 * "Open round board →", then one `LeagueOperationalMatchRow` per match. Renders exactly what
 * `buildLeagueOperatingViewModel()` resolved — no domain computation here.
 */
type Props = {
  round: LeagueFocusedRoundModel;
  className?: string;
};

const STATUS_TONE: Record<LeagueFocusedRoundModel["status"], string> = {
  CURRENT_ROUND: "text-[var(--tl-c-live)] border-[var(--tl-c-live)]",
  NEEDS_ATTENTION: "text-[var(--warning)] border-[var(--warning)]",
  READY: "text-[var(--text-soft)] border-[var(--border-soft)]",
  NEEDS_CLOSURE: "text-[var(--warning)] border-[var(--warning)]",
  UPCOMING: "text-[var(--text-muted)] border-[var(--border-soft)]",
  NOT_GENERATED: "text-[var(--text-muted)] border-[var(--border-soft)]",
  FINAL: "text-[var(--text-soft)] border-[var(--border-soft)]",
};

export function LeagueFocusedRound({ round, className }: Props) {
  return (
    <section className={cn("pt-4", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="tl-round-marker text-[var(--foreground)]">{round.title}</h2>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
            STATUS_TONE[round.status],
          )}
        >
          {round.statusLabel}
        </span>
        <span className="text-[13px] text-[var(--text-muted)]">{round.summaryLabel}</span>
        <Link
          href={round.roundBoardHref}
          className="ml-auto shrink-0 text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
        >
          Open round board <span aria-hidden="true">→</span>
        </Link>
      </div>

      {round.matches.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {round.matches.map((match) => (
            <LeagueOperationalMatchRow key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">
          This round has not been generated yet.
        </p>
      )}
    </section>
  );
}
