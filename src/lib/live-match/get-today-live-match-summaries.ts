/**
 * Bounded Today Live Now loader (ADR-0141, `03_DATA_AND_RECOMMENDATION_CONTRACT.md` "Live Now").
 * Reads durable canonical live-match state from Postgres only — one batched session query, one
 * batched event query, both scoped to the Today match ids the caller already knows have an
 * active live session. Never queries the realtime Durable Object, never polls, never
 * reimplements goal-counting/reversal semantics (reuses the shared `reduceLiveEvents()`), and
 * never derives the score/clock from `createdAt` ordering.
 */

import { db } from "@/lib/db";
import { reduceLiveEvents } from "@/lib/live-match/live-match-projection";
import { persistedToClockState } from "@/lib/live-match/session-clock";
import { getElapsedMs, formatElapsedMs } from "@/lib/live-match/match-clock";
import { getPeriodLabel } from "@/lib/live-match/live-match-domain";
import { getLeagueMatchPeriodConfig } from "@/lib/live-match/period-config";
import { snapshotToFormat } from "@/lib/live-match/match-format";
import { resolveLiveReportingPrimaryAction, type LiveReportingPrimaryAction } from "@/lib/live-match/live-reporting-primary-action";

export type TodayLiveMatchSummary = {
  matchId: string;
  sessionId: string;
  teamName: string;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  periodLabel: string;
  /** `m:ss`, or `null` when a reliable clock cannot be produced — never a fake `0:00`. */
  elapsedLabel: string | null;
  isRunning: boolean;
  /** ADR-0152 §2: the same canonical resolver Live Reporting and (later) Match Details consume
   * — Today must not independently infer "what should the coach do next" for this match. */
  primaryAction: LiveReportingPrimaryAction;
};

export type TodayLiveNowResult = {
  primary: TodayLiveMatchSummary | null;
  otherLiveCount: number;
};

export async function getTodayLiveMatchSummaries(
  organisationId: string,
  candidateMatchIds: string[],
  activeMatchId: string | undefined,
  now: Date = new Date(),
): Promise<TodayLiveNowResult> {
  if (candidateMatchIds.length === 0) {
    return { primary: null, otherLiveCount: 0 };
  }

  const sessions = await db.liveMatchSession.findMany({
    where: {
      organisationId,
      matchId: { in: candidateMatchIds },
      status: "ACTIVE",
    },
    select: {
      id: true,
      matchId: true,
      clockPeriod: true,
      clockRunning: true,
      clockPeriodStartedAt: true,
      clockElapsedBeforeMs: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
      match: { select: { startsAt: true, opponent: true, matchType: true, team: { select: { name: true } } } },
    },
  });

  if (sessions.length === 0) {
    return { primary: null, otherLiveCount: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);
  const events = await db.liveMatchEvent.findMany({
    where: { sessionId: { in: sessionIds } },
    select: {
      id: true,
      sessionId: true,
      eventType: true,
      correctsEventId: true,
      sequence: true,
    },
    orderBy: [{ sessionId: "asc" }, { sequence: "asc" }],
  });

  const eventsBySessionId = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsBySessionId.get(e.sessionId) ?? [];
    list.push(e);
    eventsBySessionId.set(e.sessionId, list);
  }

  const summariesWithKickoff = sessions.map((session) => {
    const sessionEvents = (eventsBySessionId.get(session.id) ?? []).filter((e) => e.sequence != null);
    const reduced = reduceLiveEvents(sessionEvents, []);

    const clock = persistedToClockState({
      clockPeriod: session.clockPeriod,
      clockRunning: session.clockRunning,
      clockPeriodStartedAt: session.clockPeriodStartedAt,
      clockElapsedBeforeMs: session.clockElapsedBeforeMs,
    });

    const elapsedLabel = clock ? formatElapsedMs(getElapsedMs(clock, now.getTime())) : null;

    // ADR-0146: the session's own frozen format snapshot is authoritative once Live Reporting
    // has started, same read discipline every other Live Reporting surface uses — never
    // re-resolved from current Season/Team config.
    const periodConfig = getLeagueMatchPeriodConfig(session.match.matchType, snapshotToFormat(session));
    const primaryAction = resolveLiveReportingPrimaryAction({ sessionStatus: "ACTIVE", clock, periodConfig });

    const summary: TodayLiveMatchSummary = {
      matchId: session.matchId,
      sessionId: session.id,
      teamName: session.match.team.name,
      opponentName: session.match.opponent,
      goalsFor: reduced.goalsFor,
      goalsAgainst: reduced.goalsAgainst,
      periodLabel: clock ? getPeriodLabel(clock.period) : "Live",
      elapsedLabel,
      isRunning: clock?.running ?? false,
      primaryAction,
    };

    return { summary, startsAt: session.match.startsAt };
  });

  // Situation's active match first, otherwise earliest kickoff — deterministic, no carousel.
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
