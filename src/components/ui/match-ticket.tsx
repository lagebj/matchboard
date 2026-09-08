"use client";

import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import { TeamShield } from "@/components/ui/team-shield";
import { MatchLifecycleBadge, type MatchLifecycleStatus } from "@/components/ui/status-badge";

/**
 * MatchTicket — the one canonical match visual grammar (ADR-0124 §5,
 * docs/product/adaptive-interaction-design.md §6).
 *
 * A match reads as football before it reads as a database record: symmetric
 * teams, a score/time centre, one derived lifecycle badge. Used everywhere a
 * match is shown (Today, League, Events, match-detail entry, Follow Live entry,
 * history, player participation). Do not create competing match components —
 * evolve this one.
 *
 *   Scheduled:  home — kickoff time — away        · lifecycle · date
 *   Live:       home —   score      — away        · LIVE · clock
 *   Final:      home —   score      — away        · FT · WON
 */
type MatchTicketPhase = "scheduled" | "live" | "final" | "cancelled";

export type MatchTicketResult = "win" | "loss" | "draw" | "unknown";

type MatchTicketProps = {
  /** Our team. */
  teamName: string;
  /** The opposing side (opponent display name). */
  opponentName?: string | null;
  /** True when our team plays at home — controls left/right ordering. Default true. */
  isHome?: boolean;
  /** Short calendar orientation, e.g. "SAT 12 SEP". */
  dateLabel?: string | null;
  /** Kick-off time for a scheduled match, e.g. "17:30". */
  kickoffTimeLabel?: string | null;
  /** Match clock for a live match, e.g. "37′". */
  liveClockLabel?: string | null;
  /** Derived lifecycle status (ADR-0101). Drives which phase grammar is shown. */
  lifecycleStatus?: MatchLifecycleStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: MatchTicketResult;
  /** Short W/D/L text for a final match, e.g. "WON". */
  outcomeLabel?: string | null;
  /**
   * A single quiet planning condition attached to this match — e.g. "2 decisions",
   * "1 blocked", "Report incomplete". Attaching the count to the object it belongs
   * to is required by the Today composition rule (ADR-0124 §6).
   */
  conditionLabel?: string | null;
  conditionTone?: "danger" | "warning" | "muted";
  href?: string;
  onClick?: () => void;
  className?: string;
};

function phaseFor(
  lifecycleStatus: MatchLifecycleStatus | undefined,
  hasScore: boolean,
): MatchTicketPhase {
  if (lifecycleStatus === "cancelled") return "cancelled";
  if (lifecycleStatus === "live") return "live";
  if (
    lifecycleStatus === "done" ||
    lifecycleStatus === "played" ||
    lifecycleStatus === "report_incomplete" ||
    (!lifecycleStatus && hasScore)
  ) {
    return "final";
  }
  return "scheduled";
}

const resultTint: Record<MatchTicketResult, string> = {
  win: "text-[var(--success)]",
  loss: "text-[var(--danger)]",
  draw: "text-[var(--text-soft)]",
  unknown: "text-zinc-100",
};

function TeamSide({
  name,
  align,
}: {
  name: string;
  align: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        align === "end" && "flex-row-reverse text-right",
      )}
    >
      <TeamShield teamName={name} size="md" />
      <span className="app-row-title truncate">{name}</span>
    </div>
  );
}

export function MatchTicket({
  teamName,
  opponentName,
  isHome = true,
  dateLabel,
  kickoffTimeLabel,
  liveClockLabel,
  lifecycleStatus,
  homeScore,
  awayScore,
  result = "unknown",
  outcomeLabel,
  conditionLabel,
  conditionTone = "muted",
  href,
  onClick,
  className,
}: MatchTicketProps) {
  const opponent = opponentName ?? "Opponent";
  const hasScore = homeScore != null && awayScore != null;
  const phase = phaseFor(lifecycleStatus, hasScore);

  // Left side is home, right side is away.
  const leftName = isHome ? teamName : opponent;
  const rightName = isHome ? opponent : teamName;

  const centre =
    phase === "live" || phase === "final" ? (
      <span
        className={cn(
          "app-value px-2",
          phase === "final" ? resultTint[result] : "text-zinc-50",
        )}
      >
        {hasScore ? `${homeScore} : ${awayScore}` : "—"}
      </span>
    ) : (
      <span className="app-value app-nums px-2 text-zinc-100">
        {kickoffTimeLabel ?? "—"}
      </span>
    );

  const statusLine = (() => {
    if (phase === "live") {
      return (
        <span className="flex items-center gap-1.5 text-[var(--danger)]">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden="true" />
          LIVE{liveClockLabel ? ` · ${liveClockLabel}` : ""}
        </span>
      );
    }
    if (phase === "final") {
      return <span className="text-[var(--text-muted)]">FT{outcomeLabel ? ` · ${outcomeLabel}` : ""}</span>;
    }
    // Cancelled is fully carried by the lifecycle badge — no second label.
    if (phase === "cancelled") return null;
    return dateLabel ? <span className="text-[var(--text-muted)]">{dateLabel}</span> : null;
  })();

  const conditionClass =
    conditionTone === "danger"
      ? "text-[var(--danger)]"
      : conditionTone === "warning"
        ? "text-[var(--warning)]"
        : "text-[var(--text-muted)]";

  const content = (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3.5 py-3",
        phase === "cancelled" && "opacity-60",
        (href || onClick) &&
          "hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
        className,
      )}
    >
      {/* Scoreboard row */}
      <div className="flex items-center gap-2">
        <TeamSide name={leftName} align="start" />
        {centre}
        <TeamSide name={rightName} align="end" />
      </div>

      {/* Status / orientation row */}
      <div className="flex items-center justify-between gap-2 text-[var(--text-meta)] text-[13px]">
        <div className="flex items-center gap-2">
          {lifecycleStatus && <MatchLifecycleBadge status={lifecycleStatus} size="sm" />}
          {statusLine}
        </div>
        {conditionLabel ? (
          <span className={cn("shrink-0 font-medium", conditionClass)}>{conditionLabel}</span>
        ) : phase !== "scheduled" && dateLabel ? (
          <span className="shrink-0 text-[var(--text-muted)]">{dateLabel}</span>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        <motion.div whileHover={{ y: -1, transition: { duration: 0.15, ease: "easeOut" } }}>
          {content}
        </motion.div>
      </a>
    );
  }

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className="w-full text-left"
        whileHover={{ y: -1, transition: { duration: 0.15, ease: "easeOut" } }}
        whileTap={{ scale: 0.995, transition: { duration: 0.1 } }}
      >
        {content}
      </motion.button>
    );
  }

  return content;
}
