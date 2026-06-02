"use client";

import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import { TeamShield } from "@/components/ui/team-shield";
import { ScoreCapsule, type ScoreCapsuleResult } from "@/components/ui/score-capsule";
import { StatusRail } from "@/components/ui/status-rail";
import { IntentCard } from "@/components/ui/intent-card";
import {
  Home,
  MapPin,
  Trophy,
  Calendar,
  User,
} from "lucide-react";

/**
 * MatchTicket — replace plain fixture/match rows.
 *
 * Uses TeamShield, ScoreCapsule, compact icon metadata.
 * Subtle hover lift. Keyboard accessible if actionable.
 */
type MatchTicketProps = {
  teamName: string;
  opponentName?: string | null;
  dateLabel?: string | null;
  homeAway?: string | null;
  matchType?: string | null;
  format?: string | null;
  status?: string | null;
  reportStatus?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: ScoreCapsuleResult;
  intentTitle?: string | null;
  href?: string;
  onClick?: () => void;
  className?: string;
};

function statusToRail(status?: string | null): "draft" | "finalized" | "locked" | "blocked" | "decision" | "neutral" {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s.includes("finalized")) return "finalized";
  if (s.includes("blocked")) return "blocked";
  if (s.includes("decision") || s.includes("requires")) return "decision";
  if (s.includes("locked") || s.includes("complete")) return "locked";
  if (s.includes("draft") || s.includes("ready")) return "draft";
  return "neutral";
}

function reportStatusToRail(rs?: string | null): "complete" | "missingReport" | "neutral" {
  if (!rs) return "neutral";
  const s = rs.toLowerCase();
  if (s.includes("locked") || s.includes("complete") || s.includes("reported")) return "complete";
  if (s.includes("draft") || s.includes("missing") || s.includes("incomplete")) return "missingReport";
  return "neutral";
}

export function MatchTicket({
  teamName,
  opponentName,
  dateLabel,
  homeAway,
  matchType,
  format,
  status,
  reportStatus,
  homeScore,
  awayScore,
  result = "unknown",
  intentTitle,
  href,
  onClick,
  className,
}: MatchTicketProps) {
  const hasResult = homeScore != null && awayScore != null;
  const isHome = homeAway === "HOME";

  const content = (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-[var(--surface-base)] p-4",
        "border-[var(--border-soft)]",
        (href || onClick) && "cursor-pointer hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {/* Header: status + date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusRail status={statusToRail(status)} />
          <StatusRail status={reportStatusToRail(reportStatus)} />
        </div>
        {dateLabel && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {dateLabel}
          </span>
        )}
      </div>

      {/* Body: teams + score */}
      <div className="flex items-center gap-3">
        <TeamShield teamName={teamName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100 truncate">{teamName}</p>
          {opponentName && (
            <p className="text-xs text-[var(--text-soft)] truncate">vs {opponentName}</p>
          )}
        </div>
        {hasResult && (
          <ScoreCapsule
            homeScore={homeScore}
            awayScore={awayScore}
            result={result}
            size="sm"
          />
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
        {isHome && (
          <span className="flex items-center gap-0.5">
            <Home className="h-3 w-3" aria-hidden="true" />
            Home
          </span>
        )}
        {homeAway === "AWAY" && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            Away
          </span>
        )}
        {matchType && (
          <span className="flex items-center gap-0.5">
            <Trophy className="h-3 w-3" aria-hidden="true" />
            {matchType}
          </span>
        )}
        {format && (
          <span className="flex items-center gap-0.5">
            <User className="h-3 w-3" aria-hidden="true" />
            {format}
          </span>
        )}
      </div>

      {/* Intent */}
      {intentTitle && (
        <IntentCard title={intentTitle} compact />
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        <motion.div
          whileHover={{ y: -1, transition: { duration: 0.15, ease: "easeOut" } }}
        >
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