/**
 * Event equivalent of `get-today-live-match-summaries.ts` (issue #686 / ADR-0158 slice 3). Same
 * durable-Postgres-only discipline: one batched session query, one batched event query, the
 * shared `reduceLiveEvents()` reducer, the shared `resolveLiveReportingPrimaryAction()` resolver.
 *
 * Unlike League, no "today's matches" candidate-id list is threaded in here: Today's command
 * centre (`get-assistant-command-centre.ts`) only resolves League `Match` rows today, and an
 * `ACTIVE` `EventLiveMatchSession` is self-evidently "happening right now" regardless of a
 * same-day-kickoff check, so this queries every org-scoped ACTIVE Event session directly rather
 * than widening the League-only command-centre data model for this one card.
 *
 * Event's `EventLiveMatchEvent.sequence` is always null (ARR-0046: no Durable Object
 * coordination for Event yet) — ordering by it like League's query does would silently exclude
 * every row. This instead orders by `[period, matchSeconds, createdAt]`, the same convention
 * `src/lib/evidence/actual-timeline.ts` already established for reading this table.
 */

import { db } from "@/lib/db";
import { reduceLiveEvents } from "@/lib/live-match/live-match-projection";
import { persistedToClockState } from "@/lib/live-match/session-clock";
import { getElapsedMs, formatElapsedMs } from "@/lib/live-match/match-clock";
import { getPeriodLabel } from "@/lib/live-match/live-match-domain";
import { snapshotToFormat } from "@/lib/live-match/match-format";
import { buildPeriodConfigFromFormat, getEventPeriodConfig } from "@/lib/live-match/period-config";
import { resolveLiveReportingPrimaryAction } from "@/lib/live-match/live-reporting-primary-action";
import type { TodayLiveMatchSummary, TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";

export async function getTodayEventLiveMatchSummaries(
  organisationId: string,
  activeMatchId: string | undefined,
  now: Date = new Date(),
): Promise<TodayLiveNowResult> {
  const sessions = await db.eventLiveMatchSession.findMany({
    where: { organisationId, status: "ACTIVE" },
    select: {
      id: true,
      eventMatchId: true,
      clockPeriod: true,
      clockRunning: true,
      clockPeriodStartedAt: true,
      clockElapsedBeforeMs: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
      eventMatch: {
        select: {
          startsAt: true,
          opponentName: true,
          eventId: true,
          eventSquad: { select: { name: true } },
        },
      },
    },
  });

  if (sessions.length === 0) {
    return { primary: null, otherLiveCount: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);
  const events = await db.eventLiveMatchEvent.findMany({
    where: { sessionId: { in: sessionIds } },
    select: {
      id: true,
      sessionId: true,
      eventType: true,
      correctsEventId: true,
      playerId: true,
    },
    orderBy: [{ period: "asc" }, { matchSeconds: "asc" }, { createdAt: "asc" }],
  });

  const eventsBySessionId = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsBySessionId.get(e.sessionId) ?? [];
    list.push(e);
    eventsBySessionId.set(e.sessionId, list);
  }

  const summariesWithKickoff = sessions.map((session) => {
    const sessionEvents = eventsBySessionId.get(session.id) ?? [];
    const reduced = reduceLiveEvents(sessionEvents, []);

    const clock = persistedToClockState({
      clockPeriod: session.clockPeriod,
      clockRunning: session.clockRunning,
      clockPeriodStartedAt: session.clockPeriodStartedAt,
      clockElapsedBeforeMs: session.clockElapsedBeforeMs,
    });

    const elapsedLabel = clock ? formatElapsedMs(getElapsedMs(clock, now.getTime())) : null;

    const format = snapshotToFormat(session);
    const periodConfig = format ? buildPeriodConfigFromFormat(format) : getEventPeriodConfig(null, 2, null);
    const primaryAction = resolveLiveReportingPrimaryAction({ sessionStatus: "ACTIVE", clock, periodConfig });

    const summary: TodayLiveMatchSummary = {
      matchId: session.eventMatchId,
      sessionId: session.id,
      teamName: session.eventMatch.eventSquad.name,
      opponentName: session.eventMatch.opponentName,
      goalsFor: reduced.goalsFor,
      goalsAgainst: reduced.goalsAgainst,
      periodLabel: clock ? getPeriodLabel(clock.period) : "Live",
      elapsedLabel,
      isRunning: clock?.running ?? false,
      primaryAction,
      startsAtIso: session.eventMatch.startsAt.toISOString(),
      kind: "EVENT",
      eventId: session.eventMatch.eventId,
    };

    return { summary, startsAt: session.eventMatch.startsAt };
  });

  const sorted = [...summariesWithKickoff].sort((a, b) => {
    if (activeMatchId) {
      if (a.summary.matchId === activeMatchId) return -1;
      if (b.summary.matchId === activeMatchId) return 1;
    }
    return a.startsAt.getTime() - b.startsAt.getTime();
  });

  const [primary, ...rest] = sorted;

  return {
    primary: primary.summary,
    otherLiveCount: rest.length,
  };
}
