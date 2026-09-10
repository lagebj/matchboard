import { cn } from "@/lib/cn";
import {
  type MatchPresentation,
  matchPresentationPhase,
} from "@/lib/matches/match-presentation";

/**
 * LiveScoreStrip (bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md §12`,
 * `12_COMPONENT_CONTRACTS.md §8`).
 *
 * Live Reporting ONLY. Sticky within the live page, 54–60 px, score 32–36
 * Barlow, clock visible, no read-only/action ambiguity. Never shown on Follow
 * Live. Read-only surfaces reuse the data projection but not this component.
 */
type Props = {
  presentation: MatchPresentation;
  className?: string;
};

export function LiveScoreStrip({ presentation: p, className }: Props) {
  const phase = matchPresentationPhase(p);
  const isLive = phase === "live";
  const score = p.score != null ? `${p.score.home}–${p.score.away}` : phase === "final" ? "–" : "";

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex h-[56px] items-center gap-3 border-b border-[var(--border-strong)] bg-[var(--tl-c-canvas-raised)] px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[15px] font-[600]">
        <span className={cn("truncate", p.ownTeamSide === "home" && "text-[var(--accent)]")}>{p.homeTeam}</span>
        <span className="text-[var(--text-muted)]" aria-hidden="true">
          v
        </span>
        <span className={cn("truncate", p.ownTeamSide === "away" && "text-[var(--accent)]")}>{p.awayTeam}</span>
      </div>
      {score ? <span className="tl-score-list text-[var(--foreground)]">{score}</span> : null}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] font-medium",
          isLive ? "text-[var(--tl-c-live)]" : "text-[var(--text-muted)]",
        )}
      >
        {isLive ? (
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--tl-c-live)]" aria-hidden="true" />
        ) : null}
        {isLive ? p.clockLabel ?? "LIVE" : phase === "final" ? "FT" : (p.clockLabel ?? "")}
      </span>
    </div>
  );
}
