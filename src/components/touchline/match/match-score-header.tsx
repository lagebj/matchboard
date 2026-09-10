import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  type MatchPresentation,
  matchPresentationPhase,
} from "@/lib/matches/match-presentation";

/**
 * MatchScoreHeader (bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md §11`,
 * `12_COMPONENT_CONTRACTS.md §7`).
 *
 * Match-specific identity: symmetric home/away around a Barlow Condensed hero
 * score (64 compact / 80 expanded), lifecycle readable before page controls, a
 * clock when live. The own team is marked only subtly. Page-local actions sit
 * below/adjacent — never inside the score line.
 *
 * `framed` renders the raised-card scoreboard treatment used by Follow Live and
 * the read-only viewer (bundle `11_SURFACE_MIGRATION_MAP.md` → "Follow Live:
 * Read-only scoreboard"). It is presentation only — it never forks live truth.
 */
type Props = {
  presentation: MatchPresentation;
  framed?: boolean;
  /** A quiet "‹ Back" link above the score, for match-specific pages. */
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function MatchScoreHeader({
  presentation: p,
  framed = false,
  backHref,
  backLabel = "Back",
  className,
}: Props) {
  const phase = matchPresentationPhase(p);
  const isLive = phase === "live";
  const isScheduled = phase === "scheduled";
  const isCancelled = phase === "cancelled";

  const hero = isScheduled
    ? (p.kickoffTime ?? "—")
    : isCancelled
      ? "—"
      : p.score != null
        ? `${p.score.home} : ${p.score.away}`
        : "—";

  const statusLine = isLive
    ? p.clockLabel ?? "LIVE"
    : phase === "final"
      ? `FT${p.outcomeLabel ? ` · ${title(p.outcomeLabel)}` : ""}`
      : isCancelled
        ? "Cancelled"
        : [p.kickoffDate, p.kickoffTime].filter(Boolean).join(" · ") || "Scheduled";

  return (
    <div
      className={cn(
        framed &&
          "rounded-[var(--tl-c-radius-feature)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] px-5 py-6",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2 inline-flex w-fit items-center gap-1 text-[13px] text-[var(--text-muted)] no-underline hover:text-[var(--text-soft)]"
        >
          <span aria-hidden="true">‹</span> {backLabel}
        </Link>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[16px] font-[600]",
            p.ownTeamSide === "home" ? "text-[var(--accent)]" : "text-[var(--text-soft)]",
          )}
        >
          {p.homeTeam}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-right text-[16px] font-[600]",
            p.ownTeamSide === "away" ? "text-[var(--accent)]" : "text-[var(--text-soft)]",
          )}
        >
          {p.awayTeam}
        </span>
      </div>

      <p
        className={cn(
          "tl-score-hero mt-3 text-center",
          isScheduled ? "text-[var(--foreground)]" : "text-[var(--foreground)]",
        )}
      >
        {hero}
      </p>

      <p
        className={cn(
          "mt-1 text-center",
          isLive ? "tl-clock text-[var(--tl-c-live)]" : "text-[13px] text-[var(--text-muted)]",
        )}
      >
        {statusLine}
      </p>
    </div>
  );
}

function title(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1).toLowerCase();
}
