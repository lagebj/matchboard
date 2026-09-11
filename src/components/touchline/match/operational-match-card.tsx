import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  type MatchPresentation,
  matchPresentationPhase,
} from "@/lib/matches/match-presentation";

/**
 * OperationalMatchCard (bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md §10`,
 * `07_TEMPORAL_AND_EVENT_GRAMMAR.md §6`, `12_COMPONENT_CONTRACTS.md §6`;
 * `feature` variant added by the Touchline Finish follow-up
 * `03_CODE_CHANGE_MAP.md §G`).
 *
 * Used ONLY when a match is the primary active object — Today next action, the
 * selected compact planning match, the event next match. 12 px radius, raised
 * surface, one dominant action, a score/time hierarchy, at most one attention
 * sentence. It must never become the default result-list representation
 * (that is `ScorebookMatchRow`).
 *
 * `variant="feature"` is a visual-only richer treatment (widget-strong
 * surface, feature atmosphere wash, a larger hero) for when this card is the
 * page's single dominant object (e.g. Today's hero). It reads the exact same
 * `MatchPresentation` — no route may pass raw lifecycle truth independently.
 */
type Props = {
  presentation: MatchPresentation;
  /** Accent eyebrow, e.g. "NEXT" or "NEXT · 11:10 · Pitch 3". Defaults from lifecycle. */
  kicker?: string;
  /** Quiet line under the teams, e.g. "Saturday · 13:00 · Slemmestad". */
  contextLine?: string;
  /** One dominant action for this match. */
  action?: ReactNode;
  /** One short attention sentence. */
  attentionDetail?: string;
  /** "inline" → "Home vs Away" one line; "stacked" → two lines. */
  teamLayout?: "inline" | "stacked";
  /** Override the hero value (defaults: kickoff time / "h : a" / "—"). */
  heroValue?: string;
  /** "standard" (default) or "feature" — a richer treatment for the one dominant next-action object. */
  variant?: "standard" | "feature";
  /** Small label shown instead of the resolved kicker, e.g. "G2015 · League". */
  contextLabel?: string;
  href?: string;
  className?: string;
};

export function OperationalMatchCard({
  presentation: p,
  kicker,
  contextLine,
  action,
  attentionDetail,
  teamLayout = "inline",
  heroValue,
  variant = "standard",
  contextLabel,
  href,
  className,
}: Props) {
  const phase = matchPresentationPhase(p);
  const target = href ?? p.href ?? undefined;

  const resolvedKicker =
    kicker ??
    (phase === "live" ? "LIVE" : phase === "final" ? "RESULT" : phase === "cancelled" ? "CANCELLED" : "NEXT");

  const resolvedHero =
    heroValue ??
    (phase === "scheduled"
      ? (p.kickoffTime ?? "—")
      : phase === "cancelled"
        ? "—"
        : p.score != null
          ? `${p.score.home} : ${p.score.away}`
          : "—");

  const teams =
    teamLayout === "inline" ? (
      <p className="text-[20px] font-[620] leading-tight text-[var(--foreground)]">
        <span className={cn(p.ownTeamSide === "home" && "text-[var(--accent)]")}>{p.homeTeam}</span>
        <span className="mx-1.5 font-normal text-[var(--text-muted)]">vs</span>
        <span className={cn(p.ownTeamSide === "away" && "text-[var(--accent)]")}>{p.awayTeam}</span>
      </p>
    ) : (
      <div className="space-y-0.5 text-[20px] font-[620] leading-tight text-[var(--foreground)]">
        <p className={cn(p.ownTeamSide === "home" && "text-[var(--accent)]")}>{p.homeTeam}</p>
        <p className={cn(p.ownTeamSide === "away" && "text-[var(--accent)]")}>{p.awayTeam}</p>
      </div>
    );

  const isLive = phase === "live";
  const feature = variant === "feature";

  return (
    <div
      className={cn(
        "rounded-[var(--tl-c-radius-feature)] border p-4",
        feature
          ? "tl-feature-atmosphere rounded-[var(--tl-radius-widget)] border-[var(--tl-widget-border)] bg-[var(--tl-widget-strong)] p-5 shadow-[var(--tl-widget-shadow-strong)]"
          : "border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.16em]",
            isLive ? "text-[var(--tl-c-live)]" : "text-[var(--accent)]",
          )}
        >
          {resolvedKicker}
        </p>
        {contextLabel ? (
          <p className="text-[12px] text-[var(--text-muted)]">{contextLabel}</p>
        ) : null}
      </div>

      <div className="mt-2 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {feature ? (
            <p className={cn("text-[24px] font-[650] leading-tight text-[var(--foreground)]")}>
              <span className={cn(p.ownTeamSide === "home" && "text-[var(--accent)]")}>{p.homeTeam}</span>
              <span className="mx-1.5 font-normal text-[var(--text-muted)]">vs</span>
              <span className={cn(p.ownTeamSide === "away" && "text-[var(--accent)]")}>{p.awayTeam}</span>
            </p>
          ) : (
            teams
          )}
          {contextLine ? (
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">{contextLine}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 tl-sport font-[700] leading-none",
            feature ? "text-[38px]" : "text-[34px]",
            isLive ? "text-[var(--tl-c-live)]" : "text-[var(--foreground)]",
          )}
        >
          {resolvedHero}
        </span>
      </div>

      {(attentionDetail || action) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--text-muted)]">{attentionDetail}</span>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}

      {target && !action ? (
        <Link href={target} className="mt-2 inline-block text-[13px] font-medium text-[var(--accent)] no-underline">
          Open match <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}
