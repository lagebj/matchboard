"use client";

import { useEffect, useRef } from "react";
import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import {
  startLiveSessionAction,
  heartbeatAction,
  recordLiveEventAction,
  getRecentEventsAction,
  getLiveMatchPreMatchPackageAction,
} from "@/app/(app)/matches/[matchId]/live/live-actions";
import { endLiveSessionAndCreateReportAction } from "@/app/(app)/matches/[matchId]/live/live-report-handoff";
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";
import { RealtimeMatchClient } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";

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
  };
}

/**
 * Best-effort realtime broadcast so "Follow live" viewers (read-only connections, see
 * ADR-0086's amendment) see live updates as the reporting coach records them. This is
 * deliberately NOT the canonical persistence path — `recordLiveEventAction` above (HTTP,
 * unchanged) remains the only thing that writes to Neon. If the realtime connection is
 * unavailable, not yet authenticated, or the broadcast call itself fails, this must never
 * surface an error to the coach or affect the HTTP recording outcome in any way — matching
 * ADR-0086's "realtime failure changes collaboration quality, not the coach's ability to
 * report the match" principle. A real signed Worker→Vercel persistence path (Stage 4) is a
 * separate, future concern; nothing here depends on it.
 */
function useLiveBroadcast(matchId: string) {
  const clientRef = useRef<RealtimeMatchClient | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  // Tracks the Durable Object's realtime version as last observed from a successful
  // recordEvent response. Every accepted event (append-safe or state-sensitive) advances the
  // object's version by one (state.ts's evaluateRecordEvent) — sending a stale baseVersion for
  // a state-sensitive event type (PERIOD_START, ROTATION_OUT, ...) is rejected outright
  // ("stale_state"), so a hardcoded baseVersion would only ever succeed for the first event of
  // the match and silently fail every state-sensitive broadcast after it. Self-heals after a
  // reconnect/rejection: any subsequent append-safe event (no baseVersion check) still
  // succeeds and its response realigns this to the object's true current version.
  const versionRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  function ensureConnected(): void {
    if (clientRef.current) return;
    const url = process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL;
    if (!url) return; // No realtime endpoint configured — silently no-op (kill switch, ADR-0086).

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: clientIdRef.current,
      getTicket: () => fetchRealtimeTicket(matchId, "report"),
    });
    clientRef.current = client;
    void client.connect().catch(() => {
      clientRef.current = null;
    });
  }

  function disconnect(): void {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }

  function broadcastEvent(input: { clientEventId: string; event: Record<string, unknown> }): void {
    clientRef.current
      ?.recordEvent({ ...input, baseVersion: versionRef.current })
      .then((result) => {
        const version = (result as { version?: unknown } | undefined)?.version;
        if (typeof version === "number") {
          versionRef.current = version;
        }
      })
      .catch(() => {
        // Fire-and-forget — the coach's HTTP-recorded event already succeeded independently.
      });
  }

  return { ensureConnected, disconnect, broadcastEvent };
}

function createLeagueActions(
  matchId: string,
  broadcast: ReturnType<typeof useLiveBroadcast>,
): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startLiveSessionAction(matchId);
      if (result.success && result.data) {
        broadcast.ensureConnected();
        return { success: true, data: { id: result.data.id } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endLiveSessionAndCreateReportAction(sessionId, matchId);
      broadcast.disconnect();
      if (result.success && result.data) {
        return { success: true, data: { reportId: result.data.reportId, reportStatus: result.data.reportStatus } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to end session" };
    },
    heartbeat: async (sessionId) => {
      await heartbeatAction(sessionId);
    },
    recordEvent: async (input) => {
      const result = await recordLiveEventAction(input);
      if (result.success && result.data) {
        // Best-effort broadcast side-channel — see useLiveBroadcast's doc comment.
        broadcast.broadcastEvent({
          clientEventId: input.clientEventId,
          event: { eventType: input.eventType, ...input.payload },
        });
        return { success: true as const, data: { id: result.data.eventId } };
      }
      return { success: false as const, error: result.success === false ? result.error : "Failed to record event" };
    },
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
  const broadcast = useLiveBroadcast(matchId);
  const leagueActions = createLeagueActions(matchId, broadcast);

  return (
    <LiveMatchClient
      matchId={matchId}
      teamName={matchInfo.teamName}
      opponentName={matchInfo.opponent}
      contextLabel={matchInfo.roundName}
      periodConfig={LEAGUE_PERIOD_CONFIG}
      actions={leagueActions}
    />
  );
}
