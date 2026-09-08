"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import { lifecycleStatusConfigFor } from "@/components/ui/status-badge";
import {
  type MatchPresentation,
  matchPresentationPhase,
  primaryAttention,
} from "@/lib/matches/match-presentation";

/**
 * Match Presentation System — exactly three canonical variants of the one
 * `MatchPresentation` projection (ADR-0125,
 * `.matchboard-work/matchboard-reference-convergence-programme/03_NBA_MATCH_SPEC.md`):
 *
 *   - `MatchScoreRow`  — dense divider-based scan row (League, Today timeline,
 *                        event timelines, results/history). No card border.
 *   - `MatchCard`      — the match as a primary object with page context around
 *                        it (Today next-action hero, Round Board / event selected
 *                        match). One bordered card, one dominant action.
 *   - `MatchHeader`    — match-page identity; state readable before page controls.
 *
 * Football order is always home then away. The own team is marked only subtly
 * (accent weight on its name), never reordered to the front, never given a logo.
 * Score / kickoff time share one stable right-aligned value lane so a list of
 * matches scans vertically.
 */

const VALUE_LANE = "w-[3.5rem] shrink-0 text-right tabular-nums";

const outcomeTint: Record<MatchPresentation["resultOutcomeForOwnTeam"], string> = {
  win: "text-[var(--success)]",
  loss: "text-[var(--danger)]",
  draw: "text-[var(--text-soft)]",
  unknown: "text-zinc-50",
};

function attentionClass(tone: "danger" | "warning" | "muted"): string {
  return tone === "danger"
    ? "text-[var(--danger)]"
    : tone === "warning"
      ? "text-[var(--warning)]"
      : "text-[var(--text-muted)]";
}

function TeamName({
  name,
  isOwn,
  className,
}: {
  name: string;
  isOwn: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "app-row-title min-w-0 truncate",
        isOwn && "text-[var(--accent)]",
        className,
      )}
    >
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Score row                                                                */
/* ------------------------------------------------------------------------- */

type MatchScoreRowProps = {
  presentation: MatchPresentation;
  /** Falls back to `presentation.href`. */
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function MatchScoreRow({ presentation: p, href, onClick, className }: MatchScoreRowProps) {
  const phase = matchPresentationPhase(p);
  const attention = primaryAttention(p);
  const target = href ?? p.href ?? undefined;

  const homeValue =
    phase === "scheduled" ? (p.kickoffTime ?? "—") : phase === "cancelled" ? "—" : (p.score?.home ?? "—");
  const awayValueIsDate = phase === "scheduled";
  const awayValue = awayValueIsDate
    ? (p.kickoffDate ?? "")
    : phase === "cancelled"
      ? "—"
      : (p.score?.away ?? "—");

  const valueTint = phase === "final" ? outcomeTint[p.resultOutcomeForOwnTeam] : "text-zinc-50";

  // Scheduled inlines its one attention into the status line; live/final show it
  // on the right of the status row (07 §5 — one status line + at most one
  // secondary attention). Report-incomplete on a final match already reads on
  // the status line ("FT · Report incomplete"), so it is not repeated right.
  const finalTail = phase === "final" ? (p.outcomeLabel ?? p.reportAttention?.label ?? null) : null;
  const statusLine = (() => {
    if (phase === "live") {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--danger)]">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden="true" />
          LIVE{p.clockLabel ? ` · ${p.clockLabel}` : ""}
        </span>
      );
    }
    if (phase === "final") {
      return (
        <span
          className={cn(
            "text-[var(--text-muted)]",
            p.reportAttention && !p.outcomeLabel && attentionClass(p.reportAttention.tone),
          )}
        >
          FT{finalTail ? ` · ${finalTail}` : ""}
        </span>
      );
    }
    if (phase === "cancelled") {
      return <span className="text-[var(--text-muted)]">CANCELLED</span>;
    }
    return (
      <span className="text-[var(--text-muted)]">
        {lifecycleStatusConfigFor(p.lifecycle).label}
        {attention ? (
          <>
            {" · "}
            <span className={cn("font-medium", attentionClass(attention.tone))}>{attention.label}</span>
          </>
        ) : null}
      </span>
    );
  })();

  const rightSlot =
    (phase === "live" || (phase === "final" && p.outcomeLabel)) && attention ? (
      <span className={cn("shrink-0 font-medium", attentionClass(attention.tone))}>{attention.label}</span>
    ) : null;

  const body = (
    <div
      className={cn(
        "flex flex-col gap-1 py-2.5",
        phase === "cancelled" && "opacity-60",
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <TeamName name={p.homeTeam} isOwn={p.ownTeamSide === "home"} />
        <span className={cn("app-value", VALUE_LANE, valueTint)}>{homeValue}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <TeamName name={p.awayTeam} isOwn={p.ownTeamSide === "away"} />
        {awayValueIsDate ? (
          <span className={cn(VALUE_LANE, "text-[var(--text-meta)] text-[13px] text-[var(--text-muted)]")}>
            {awayValue}
          </span>
        ) : (
          <span className={cn("app-value", VALUE_LANE, valueTint)}>{awayValue}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[13px]">
        {statusLine}
        {rightSlot}
      </div>
      {p.cancelledReason ? (
        <span className="text-[11px] text-[var(--text-muted)] truncate">{p.cancelledReason}</span>
      ) : null}
    </div>
  );

  if (target) {
    return (
      <Link href={target} className="block no-underline hover:bg-[var(--surface-hover)] -mx-2 px-2 rounded-lg transition-colors">
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left hover:bg-[var(--surface-hover)] -mx-2 px-2 rounded-lg transition-colors"
      >
        {body}
      </button>
    );
  }
  return body;
}

/* ------------------------------------------------------------------------- */
/* Match card                                                               */
/* ------------------------------------------------------------------------- */

type MatchCardProps = {
  presentation: MatchPresentation;
  /** One dominant action for this match. */
  action?: ReactNode;
  /** One short attention sentence shown under the status line. */
  attentionDetail?: string;
  href?: string;
  className?: string;
};

export function MatchCard({ presentation: p, action, attentionDetail, href, className }: MatchCardProps) {
  const phase = matchPresentationPhase(p);
  const attention = primaryAttention(p);
  const target = href ?? p.href ?? undefined;

  const eyebrow = [p.kickoffDate, p.kickoffTime].filter(Boolean).join(" · ") || null;

  const homeValue = phase === "scheduled" || phase === "cancelled" ? null : (p.score?.home ?? null);
  const awayValue = phase === "scheduled" || phase === "cancelled" ? null : (p.score?.away ?? null);
  const valueTint = phase === "final" ? outcomeTint[p.resultOutcomeForOwnTeam] : "text-zinc-50";

  const statusText =
    phase === "live"
      ? `LIVE${p.clockLabel ? ` · ${p.clockLabel}` : ""}`
      : phase === "final"
        ? `FT${p.outcomeLabel ? ` · ${p.outcomeLabel}` : p.reportAttention ? ` · ${p.reportAttention.label}` : ""}`
        : phase === "cancelled"
          ? "CANCELLED"
          : lifecycleStatusConfigFor(p.lifecycle).label.toUpperCase();

  const detail = attentionDetail ?? attention?.label ?? null;

  const card = (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4",
        phase === "cancelled" && "opacity-70",
        target && "hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-3">
          <TeamName name={p.homeTeam} isOwn={p.ownTeamSide === "home"} className="text-[17px]" />
          {homeValue != null ? (
            <span className={cn("app-value", VALUE_LANE, valueTint)}>{homeValue}</span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-3">
          <TeamName name={p.awayTeam} isOwn={p.ownTeamSide === "away"} className="text-[17px]" />
          {awayValue != null ? (
            <span className={cn("app-value", VALUE_LANE, valueTint)}>{awayValue}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "app-eyebrow",
            phase === "live" && "text-[var(--danger)]",
          )}
        >
          {statusText}
        </span>
        {detail ? (
          <span
            className={cn(
              "text-[13px]",
              attention ? attentionClass(attention.tone) : "text-[var(--text-muted)]",
            )}
          >
            {detail}
          </span>
        ) : null}
      </div>

      {action ? <div className="pt-0.5">{action}</div> : null}
    </div>
  );

  if (target && !action) {
    return (
      <Link href={target} className="block no-underline">
        <motion.div whileHover={{ y: -1, transition: { duration: 0.15, ease: "easeOut" } }}>
          {card}
        </motion.div>
      </Link>
    );
  }
  return card;
}

/* ------------------------------------------------------------------------- */
/* Match header                                                             */
/* ------------------------------------------------------------------------- */

type MatchHeaderProps = {
  presentation: MatchPresentation;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function MatchHeader({ presentation: p, backHref, backLabel = "Back", className }: MatchHeaderProps) {
  const phase = matchPresentationPhase(p);
  const hasScore = p.score != null;
  const valueTint = phase === "final" ? outcomeTint[p.resultOutcomeForOwnTeam] : "text-zinc-50";

  const scoreOrTime =
    phase === "scheduled"
      ? (p.kickoffTime ?? "—")
      : phase === "cancelled"
        ? "—"
        : hasScore
          ? `${p.score!.home} : ${p.score!.away}`
          : "—";

  const statusLine = (() => {
    if (phase === "live") {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--danger)]">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden="true" />
          LIVE{p.clockLabel ? ` · ${p.clockLabel}` : ""}
        </span>
      );
    }
    if (phase === "final") {
      return (
        <span className="text-[var(--text-muted)]">
          FT{p.outcomeLabel ? ` · ${p.outcomeLabel}` : p.reportAttention ? ` · ${p.reportAttention.label}` : ""}
        </span>
      );
    }
    if (phase === "cancelled") return <span className="text-[var(--text-muted)]">CANCELLED</span>;
    return (
      <span className="text-[var(--text-muted)]">
        {[p.kickoffDate, lifecycleStatusConfigFor(p.lifecycle).label.toUpperCase()].filter(Boolean).join(" · ")}
      </span>
    );
  })();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-[13px] text-[var(--text-muted)] no-underline hover:text-[var(--text-soft)]"
        >
          ‹ {backLabel}
        </Link>
      ) : null}

      {/* Compact: stacked home/away with per-line value. Expanded: one inline line. */}
      <div className="flex flex-col gap-1 expanded:hidden">
        <div className="flex items-baseline gap-3">
          <TeamName name={p.homeTeam} isOwn={p.ownTeamSide === "home"} className="text-[19px]" />
          <span className={cn("app-value text-[24px]", VALUE_LANE, valueTint)}>
            {phase === "scheduled" || phase === "cancelled" ? (phase === "cancelled" ? "—" : "") : (p.score?.home ?? "—")}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <TeamName name={p.awayTeam} isOwn={p.ownTeamSide === "away"} className="text-[19px]" />
          <span className={cn("app-value text-[24px]", VALUE_LANE, valueTint)}>
            {phase === "scheduled" ? (p.kickoffTime ?? "—") : phase === "cancelled" ? "—" : (p.score?.away ?? "—")}
          </span>
        </div>
      </div>

      <div className="hidden items-baseline justify-center gap-4 expanded:flex">
        <TeamName
          name={p.homeTeam}
          isOwn={p.ownTeamSide === "home"}
          className="flex-1 text-right text-[20px]"
        />
        <span className={cn("app-value text-[28px]", valueTint)}>{scoreOrTime}</span>
        <TeamName name={p.awayTeam} isOwn={p.ownTeamSide === "away"} className="flex-1 text-[20px]" />
      </div>

      <div className="text-[13px] expanded:text-center">{statusLine}</div>
    </div>
  );
}
