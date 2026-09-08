"use client";

import { useEffect, useState } from "react";
import { listEventMatchesAction } from "@/app/(app)/events/event-match-actions";
import type { EventMatchWithReport } from "@/lib/stats/event-match-stats";
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import { MatchScoreRow } from "@/components/ui/match-presentation";
import { OperationalTimeline, TimelineItem, type TimelineNodeState } from "@/components/ui/operational-timeline";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import { formatKickoffTime } from "@/lib/date-utils";

/**
 * Event-day match timeline (ADR-0125). Event detail leads with the day's football
 * in chronological order — one `OperationalTimeline` of `MatchScoreRow` items —
 * above squad/helper administration. Fetches its own matches (mirrors
 * `EventMatchesTab`) so the big page loader is untouched.
 */
type Props = {
  eventId: string;
  squadNames: Record<string, string>;
};

/** A minimal event-match lifecycle. Event matches carry no planning-boundary
 * record, so this is derived from schedule + report status only. */
function deriveEventMatchLifecycle(m: EventMatchWithReport, now: Date): MatchLifecycleStatus {
  if (m.status === "CANCELLED") return "cancelled";
  const reportStatus = m.report?.status ?? null;
  if (reportStatus === "LOCKED") return "done";
  if (reportStatus === "DRAFT" || reportStatus === "REPORTED") return "report_incomplete";
  if (m.startsAt.getTime() <= now.getTime()) return "played";
  return "planning_open";
}

function outcomeFor(our: number | null, opp: number | null): "WON" | "DRAWN" | "LOST" | null {
  if (our == null || opp == null) return null;
  if (our > opp) return "WON";
  if (our < opp) return "LOST";
  return "DRAWN";
}

export function EventDayTimeline({ eventId, squadNames }: Props) {
  const [matches, setMatches] = useState<EventMatchWithReport[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEventMatchesAction(eventId)
      .then((rows) => {
        if (!cancelled) setMatches(rows);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!matches || matches.length === 0) return null;

  const now = new Date();
  const sorted = [...matches].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const firstUpcomingId = sorted.find(
    (m) => m.status !== "CANCELLED" && m.startsAt.getTime() > now.getTime() && !m.report,
  )?.id;
  const lastIndex = sorted.length - 1;

  return (
    <Surface variant="default" padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Event day" description="Matches in order." />
      <OperationalTimeline aria-label="Event-day match timeline">
        {sorted.map((m, idx) => {
          const lifecycle = deriveEventMatchLifecycle(m, now);
          const needsReport = lifecycle === "played" || lifecycle === "report_incomplete";
          const state: TimelineNodeState =
            lifecycle === "live"
              ? "current"
              : needsReport
                ? "attention"
                : lifecycle === "done"
                  ? "done"
                  : m.id === firstUpcomingId
                    ? "next"
                    : "later";
          const kicker =
            state === "attention"
              ? "FOLLOW-UP"
              : state === "next"
                ? "NEXT"
                : state === "done"
                  ? null
                  : "LATER";
          const presentation = buildMatchPresentation({
            id: m.id,
            teamName: squadNames[m.eventSquadId] ?? "Squad",
            opponentName: m.opponentName,
            isHome: true,
            kickoffAt: m.startsAt,
            lifecycleStatus: lifecycle,
            ownGoals: m.report?.ourScore ?? null,
            opponentGoals: m.report?.opponentScore ?? null,
            outcome: outcomeFor(m.report?.ourScore ?? null, m.report?.opponentScore ?? null),
            cancelledReason: m.status === "CANCELLED" ? m.cancelledReason : null,
          });
          return (
            <TimelineItem
              key={m.id}
              timeLabel={formatKickoffTime(m.startsAt)}
              state={state}
              kicker={kicker}
              isLast={idx === lastIndex}
            >
              <MatchScoreRow presentation={presentation} />
            </TimelineItem>
          );
        })}
      </OperationalTimeline>
    </Surface>
  );
}
