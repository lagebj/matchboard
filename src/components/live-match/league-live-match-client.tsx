"use client";

import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import {
  startLiveSessionAction,
  heartbeatAction,
  getRecentEventsAction,
  getLiveMatchPreMatchPackageAction,
  persistLiveSessionClockAction,
} from "@/app/(app)/matches/[matchId]/live/live-actions";
import { endLiveSessionAndCreateReportAction } from "@/app/(app)/matches/[matchId]/live/live-report-handoff";
import type { PeriodConfig } from "@/lib/live-match/period-config";
import type { MatchType } from "@/generated/prisma/client";
import { useLiveRealtime } from "@/components/live-match/use-live-realtime";

interface LiveMatchClientProps {
  matchId: string;
  matchInfo: {
    id: string;
    opponent: string;
    homeAway: string;
    gameFormat: string;
    startsAt: string;
    status: string;
    teamName: string;
    teamId: string;
    roundName: string | null;
    matchType: MatchType;
    // ADR-0146: resolved server-side by the page (resolveLeagueMatchPeriodConfig) -- the frozen
    // Live Reporting snapshot when one exists, else the existing hardcoded legacy config.
    periodConfig: PeriodConfig[];
  };
}

// ADR-0138 Bundle 8 — `useLiveRealtime` moved to `use-live-realtime.ts` and generalized with a
// `subjectType` parameter so `event-live-match-client.tsx` can reuse the exact same coordinator-
// connection logic instead of a second, independently-maintained copy. Re-exported here so any
// existing import of `useLiveRealtime` from this module keeps working unchanged.
export { useLiveRealtime };

export function createLeagueActions(
  matchId: string,
  realtime: ReturnType<typeof useLiveRealtime>,
): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startLiveSessionAction(matchId);
      if (result.success && result.data) {
        realtime.ensureConnected();
        return {
          success: true,
          data: {
            id: result.data.id,
            startedAt: result.data.startedAt.toISOString(),
            format: result.data.format,
          },
        };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endLiveSessionAndCreateReportAction(sessionId, matchId);
      realtime.disconnect();
      if (result.success && result.data) {
        return { success: true, data: { reportId: result.data.reportId, reportStatus: result.data.reportStatus } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to end session" };
    },
    heartbeat: async (sessionId) => {
      await heartbeatAction(sessionId);
    },
    persistClock: async (sessionId, clock) => {
      // ADR-0133 H2 — best-effort clock persistence on a transition.
      return persistLiveSessionClockAction(sessionId, {
        period: clock.period,
        running: clock.running,
        startedAt: clock.startedAt ? clock.startedAt.toISOString() : null,
        elapsedBeforeStartMs: clock.elapsedBeforeStartMs,
      });
    },
    // ADR-0138 (Bundle 4) — the coordinator is the only normal canonical-ordering path. Both
    // "persisted" and "pending" are genuine coordinator acceptance (a real, coordinator-
    // assigned sequence exists either way); the Durable Object's own persistence outbox
    // (Stage 6) already owns confirming durability for a "pending" result, so neither case
    // triggers an independent HTTP write here — doing so would recreate the exact dual-write-
    // path residue this bundle closes (ARR-0045). When the coordinator is unavailable or the
    // RPC failed (`tryRecordEvent` returned no result), the command is left unsynchronized
    // rather than persisted through an alternate ordering authority — it stays safely in the
    // local outbox (already durably saved before this function is called) and is retried
    // through this same function on the next reconnect. A genuine conflict (Bundle 8) is
    // reported distinctly so `attemptSend` can move the command to `NEEDS_REVIEW` instead of
    // retrying it forever.
    recordEvent: async (input) => {
      const outcome = await realtime.tryRecordEvent({
        clientEventId: input.clientEventId,
        event: {
          eventType: input.eventType,
          period: input.period,
          matchSeconds: input.matchSeconds,
          playerId: input.playerId,
          secondaryPlayerId: input.secondaryPlayerId,
          payload: input.payload,
          correctionType: input.correctionType,
          correctsEventId: input.correctsEventId,
        },
      });
      if (outcome.result) {
        return { success: true as const, data: { persistenceStatus: outcome.result.persistenceStatus } };
      }
      if (outcome.conflict) {
        return { success: false as const, error: outcome.conflict.message, conflict: outcome.conflict };
      }
      return {
        success: false as const,
        error: "Not connected to live reporting. Saved on this device — will sync automatically once reconnected.",
      };
    },
    onLiveUpdate: realtime.onLiveUpdate,
    onPersistenceChanged: realtime.onPersistenceChanged,
    reconnectRealtime: realtime.reconnectNow,
    getRecentEvents: async (matchId, limit) => {
      const result = await getRecentEventsAction(matchId, limit);
      if (result.success && result.data) {
        return { success: true, data: result.data as LiveEventSummary[] };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to get events" };
    },
    getPreMatchPackage: async (matchId) => {
      const result = await getLiveMatchPreMatchPackageAction(matchId);
      if (result.success && result.data) {
        return {
          success: true,
          data: {
            squad: result.data.squad as SquadPlayer[],
            activeSession: result.data.activeSession,
          },
        };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to load match data" };
    },
    reportUrl: (_reportId: string) => `/matches/${matchId}/post-match`,
  };
}

export function LeagueLiveMatchClient({ matchId, matchInfo }: LiveMatchClientProps) {
  const realtime = useLiveRealtime(matchId, "LEAGUE");
  const leagueActions = createLeagueActions(matchId, realtime);

  return (
    <LiveMatchClient
      matchId={matchId}
      teamName={matchInfo.teamName}
      opponentName={matchInfo.opponent}
      contextLabel={matchInfo.roundName}
      periodConfig={matchInfo.periodConfig}
      actions={leagueActions}
      isHome={matchInfo.homeAway === "HOME"}
      subjectType="LEAGUE"
    />
  );
}
