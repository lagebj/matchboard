"use client";

/**
 * Today Matchday hero (ADR-0143, `04_COMPOSITION_AND_DEDUPLICATION.md` §4.2-4.4). The pre-live
 * companion to `TodayLiveNow`, occupying the same top-of-column anchor: a single deterministic
 * featured same-day match (League or Event), its phase-derived countdown, a compact readiness
 * summary, and exactly one primary action.
 *
 * Deliberately no nested readiness cards, progress rings, percentages, traffic-light meters, KPI
 * tile grids, new background imagery, badges, or player photos (§4.3) — plain Touchline surface
 * and typography only.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { TouchlineButton } from "@/components/touchline";
import { formatKickoffTime } from "@/lib/date-utils";
import type { TodayFootballMatch } from "@/lib/touchline/presentation/today-football-match";
import {
  formatMatchdayCountdown,
  resolveTodayMatchdayPhase,
  type TodayMatchdayPhase,
} from "@/lib/touchline/presentation/today-matchday-phase";
import {
  formatSelectedAvailabilityLine,
  formatSquadPlannedLine,
  type TodayMatchdayAction,
  type TodayMatchdayReadiness,
} from "@/lib/touchline/presentation/today-matchday-readiness";

function headerCountdown(phase: TodayMatchdayPhase, minutesToKickoff: number | null): string | null {
  if (phase === "VERIFY" || phase === "IMMINENT") {
    if (minutesToKickoff == null) return null;
    return `Kickoff in ${formatMatchdayCountdown(minutesToKickoff)}`;
  }
  return null;
}

export function TodayMatchday({
  match,
  readiness,
  action,
  nowIso,
}: {
  match: TodayFootballMatch;
  readiness: TodayMatchdayReadiness;
  action: TodayMatchdayAction;
  nowIso: string;
}) {
  const { phase, minutesToKickoff } = resolveTodayMatchdayPhase({
    nowIso,
    startsAtIso: match.startsAt,
    lifecycleStatus: match.lifecycleStatus,
    hasActiveLiveSession: match.hasActiveLiveSession,
    canEnterLiveReporting: match.liveEntryHref != null,
  });

  const isPostMatch = phase === "POST_MATCH";
  const kickoffTime = match.startsAt ? formatKickoffTime(new Date(match.startsAt)) : null;
  const countdown = headerCountdown(phase, minutesToKickoff);
  const metaParts = [match.venueLabel, match.containerLabel].filter(Boolean);

  return (
    <Surface variant="active" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {isPostMatch ? "Today's match" : "Matchday"}
        </p>
        <span className="text-xs text-[var(--text-muted)]">{countdown ?? (isPostMatch ? null : kickoffTime)}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-[18px] font-[620] leading-snug text-[var(--foreground)]">{match.teamOrSquadName}</p>
          <p className="text-[15px] text-[var(--text-soft)]">vs {match.opponentName}</p>
          {metaParts.length > 0 && (
            <p className="text-[12px] text-[var(--text-muted)]">{metaParts.join(" · ")}</p>
          )}
        </div>
        {isPostMatch ? (
          <span className="font-mono text-[18px] font-semibold text-[var(--foreground)]">
            {match.score ? `${match.score.own}\u2013${match.score.opponent}` : "FT"}
          </span>
        ) : (
          countdown && kickoffTime && (
            <span className="text-sm font-semibold text-[var(--foreground)]">{kickoffTime}</span>
          )
        )}
      </div>

      {isPostMatch ? (
        <p className="text-[13px] text-[var(--text-soft)]">
          FT{match.containerLabel ? ` · ${match.containerLabel}` : ""} ·{" "}
          {match.lifecycleStatus === "done" ? "Report complete" : "Report incomplete"}
        </p>
      ) : (
        <div className="flex flex-col gap-1 text-[13px] text-[var(--text-soft)]">
          <p>{formatSquadPlannedLine(readiness.selection)}</p>
          {readiness.selectedAvailability && (
            <p>{formatSelectedAvailabilityLine(readiness.selectedAvailability)}</p>
          )}
          <p>{readiness.lineup.state === "READY" ? "Lineup prepared" : "Lineup not prepared"}</p>
        </div>
      )}

      {!isPostMatch && action.detail && (
        <div className="flex flex-col gap-0.5 rounded-[var(--tl-c-radius-inner,8px)] border border-[var(--border-subtle)] bg-[var(--tl-c-surface)] px-3 py-2">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">{action.title}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{action.detail}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TouchlineButton
          as={Link}
          href={action.actionHref}
          variant="primary"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {action.actionLabel}
        </TouchlineButton>
        {/* Lineup review always points at the match/event detail page, where League and Event
            lineups are both canonically reviewed — no second lineup route is introduced. There
            is no canonical, distinctly-persisted tactics record or route in the domain model, so
            no "Review tactics" action is offered here (D7 — never fabricate one). */}
        {action.kind !== "MISSING_LINEUP" && (
          <TouchlineButton as={Link} href={match.href} variant="ghost" size="sm">
            Review lineup
          </TouchlineButton>
        )}
      </div>
    </Surface>
  );
}
