/**
 * Today's operational timeline (ADR-0125, relocated to the lower operational summary position by
 * ADR-0142). One chronological rail: today's matches as `MatchRow` items with now/next/later
 * treatment. A match that has been played but still needs its report becomes an `attention` node
 * with an inline "Complete report" action — never quietened while the follow-up is open. Reports
 * for older matches stay in "Other attention" rather than being duplicated here.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { formatKickoffTime } from "@/lib/date-utils";
import type { TodayMatch } from "@/lib/assistant/types";
import { todayMatchPresentation, resolveFeaturedUpcomingMatch } from "@/lib/matches/today-match-presentation";
import {
  TouchlineButton,
  ScorebookMatchRow,
  TouchlineTimeline as OperationalTimeline,
  TimelineItem,
} from "@/components/touchline";
import type { TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";

export function TodayOperationalTimeline({
  matches,
  orgUrl,
}: {
  matches: TodayMatch[];
  orgUrl: (path: string) => string;
}) {
  const sorted = [...matches].sort((a, b) => {
    const av = a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER;
    const bv = b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER;
    return av - bv;
  });

  if (sorted.length === 0) return null;

  // First still-upcoming (not live, not played) match is NEXT; the rest LATER. Same selection
  // the Today Atlas hero features (`resolveFeaturedUpcomingMatch()`).
  const firstUpcomingId = resolveFeaturedUpcomingMatch(matches)?.matchId;

  const liveCount = matches.filter((m) => m.hasActiveLiveSession).length;
  const rows: ReactNode[] = [];
  const lastIndex = sorted.length - 1;

  sorted.forEach((match, idx) => {
    const needsReport =
      match.lifecycleStatus === "played" || match.lifecycleStatus === "report_incomplete";
    const state: TimelineNodeState =
      match.lifecycleStatus === "live"
        ? "live"
        : needsReport
          ? "current"
          : match.lifecycleStatus === "done"
            ? "done"
            : match.matchId === firstUpcomingId
              ? "next"
              : "later";
    const kicker =
      state === "live"
        ? "LIVE"
        : needsReport
          ? "FOLLOW-UP"
          : state === "next"
            ? "NEXT"
            : state === "done"
              ? null
              : "LATER";
    const href =
      match.squadStatus === "not_generated"
        ? orgUrl(`/fixtures`)
        : orgUrl(`/matches/${match.matchId}`);

    rows.push(
      <TimelineItem
        key={match.matchId}
        timeLabel={match.startsAt ? formatKickoffTime(new Date(match.startsAt)) : null}
        state={state}
        kicker={kicker}
        isLast={idx === lastIndex}
      >
        <ScorebookMatchRow presentation={todayMatchPresentation(match, href)} />
        {match.hasActiveLiveSession ? (
          <TouchlineButton
            as={Link}
            href={orgUrl(`/matches/${match.matchId}/live/follow`)}
            variant="primary"
            size="sm"
            className="mt-1"
          >
            Follow live
          </TouchlineButton>
        ) : needsReport ? (
          <TouchlineButton
            as={Link}
            href={orgUrl(`/matches/${match.matchId}`)}
            variant="ghost"
            size="sm"
            className="mt-1"
            trailingIcon={<FileText className="h-3 w-3" aria-hidden="true" />}
          >
            Complete report
          </TouchlineButton>
        ) : null}
      </TimelineItem>,
    );
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-[620] text-[var(--foreground)]">Today in order</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Today&rsquo;s football, in order.</p>
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">
          {liveCount > 0 ? `${liveCount} live · ` : ""}
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <OperationalTimeline aria-label="Today's operational timeline">{rows}</OperationalTimeline>
    </section>
  );
}
