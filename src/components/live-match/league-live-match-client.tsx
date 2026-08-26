"use client";

import { useCallback, useEffect, useRef } from "react";
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
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";
import type { MatchType } from "@/generated/prisma/client";
import { RealtimeMatchClient } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import type {
  RecordEventResult,
  ApplyEventCallback,
  PresenceChangedCallback,
  ClientAck,
} from "@/lib/live-match/realtime/realtime-messages";

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
  };
}

function ack(): ClientAck {
  return { acknowledged: true };
}

const LOG_PREFIX = "[live-match:league-realtime]";

/**
 * Realtime integration for the reporting coach (SPEC.md §5, §20, §22, §27, §28 — Stage 5).
 * When connected and authenticated with `"report"` capability, `MatchSession.recordEvent()`
 * is the *primary* write path: `tryRecordEvent()` is attempted first, and only when it's
 * unavailable, throws, or the connection isn't up yet does `recordEvent` in
 * `createLeagueActions` fall through to the original HTTP path (`recordLiveEventAction`,
 * completely unchanged — see that call site). This is a real behavior change from the
 * "Follow live"-era PR #344, which ran the HTTP write unconditionally and treated realtime as
 * a pure best-effort side-channel; Stage 4 (signed internal persistence, already merged into
 * this branch) is what makes trusting the realtime path's own persistence result safe to do.
 *
 * `applyEvent`/`presenceChanged`/`sessionEnded` broadcasts (including ones triggered by a
 * *second* reporter on the same match, SPEC.md §44 scenario 2) fire `notifyListeners()`,
 * which `LiveMatchActions.onLiveUpdate` exposes to `LiveMatchClient` so it can refresh
 * immediately rather than waiting for its own 5s poll.
 */
export function useLiveRealtime(matchId: string) {
  const clientRef = useRef<RealtimeMatchClient | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const listenersRef = useRef<Set<() => void>>(new Set());
  // Tracks the Durable Object's realtime version as last observed from a successful
  // recordEvent response (or a STALE_STATE rejection's currentVersion, which self-heals the
  // very next attempt instead of repeating the same failure for every subsequent
  // state-sensitive event — see tryRecordEvent below). Every accepted event (append-safe or
  // state-sensitive) advances the object's version by one (state.ts's evaluateRecordEvent).
  const versionRef = useRef<number>(0);

  const notifyListeners = useCallback(() => {
    for (const listener of listenersRef.current) listener();
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  function ensureConnected(): void {
    if (clientRef.current) return;
    const url = process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL;
    if (!url) {
      console.debug(`${LOG_PREFIX} NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL not set — realtime disabled (kill switch)`);
      return;
    }

    console.debug(`${LOG_PREFIX} connecting (matchId=%s, url=%s)`, matchId, url);

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: clientIdRef.current,
      getTicket: () => fetchRealtimeTicket(matchId, "report"),
      onConnectionStateChange: (state) => {
        if (state !== "connected") return;
        console.debug(`${LOG_PREFIX} connected, fetching snapshot`);
        client
          .getSnapshot()
          .then((snapshot) => {
            const version = (snapshot as { version?: unknown } | undefined)?.version;
            if (typeof version === "number") versionRef.current = version;
            console.debug(`${LOG_PREFIX} snapshot received (version=%d)`, versionRef.current);
            notifyListeners();
          })
          .catch((error) => {
            console.warn(`${LOG_PREFIX} snapshot fetch failed (non-fatal): %s`, error instanceof Error ? error.message : String(error));
          });
      },
      callbackHandlers: {
        applyEvent: (raw) => {
          const params = raw as ApplyEventCallback;
          console.debug(`${LOG_PREFIX} broadcast received: %s (version=%d)`, params.event.eventType, params.version);
          notifyListeners();
          return ack();
        },
        presenceChanged: (raw) => {
          const params = raw as PresenceChangedCallback;
          console.debug(`${LOG_PREFIX} presence changed: connectedCount=%d`, params.connectedCount);
          notifyListeners();
          return ack();
        },
        sessionEnded: (_raw) => {
          console.warn(`${LOG_PREFIX} session ended by server`);
          notifyListeners();
          return ack();
        },
      },
    });
    clientRef.current = client;
    void client.connect().catch((error) => {
      console.error(`${LOG_PREFIX} connect failed: %s`, error instanceof Error ? error.message : String(error));
      clientRef.current = null;
    });
  }

  function disconnect(): void {
    console.debug(`${LOG_PREFIX} disconnecting`);
    clientRef.current?.disconnect();
    clientRef.current = null;
  }

  /** Force an immediate reconnect attempt, bypassing the client's own backoff timer (SPEC.md
   * §27: "on browser online... reconnect" — a passive timer could otherwise leave the coach
   * on HTTP-only for up to ~30s after connectivity actually returns). No-op if never
   * connected in the first place (nothing to reconnect). */
  function reconnectNow(): void {
    console.debug(`${LOG_PREFIX} reconnectNow: forcing immediate reconnect`);
    void clientRef.current?.connect();
  }

  function onLiveUpdate(callback: () => void): () => void {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }

  /**
   * The primary write path (point 2 of Stage 5's directive). Returns `null` when realtime
   * isn't connected/authenticated or the RPC call itself fails/rejects (including a
   * STALE_STATE rejection for a state-sensitive event) — in every `null` case the caller
   * falls through to the existing HTTP path, which is always correct regardless of realtime
   * state and safe to call even if this attempt partially succeeded, since
   * `recordEventForActor`'s `clientEventId` dedup (Stage 4) guarantees at most one canonical
   * Neon row either way (SPEC.md §22 Case E, §28 "If HTTP fallback persists first... no
   * duplicate is created").
   */
  async function tryRecordEvent(input: {
    clientEventId: string;
    event: Record<string, unknown>;
  }): Promise<RecordEventResult | null> {
    const client = clientRef.current;
    if (!client || client.connectionState !== "connected") return null;

    try {
      const result = (await client.recordEvent({
        clientEventId: input.clientEventId,
        baseVersion: versionRef.current,
        event: input.event,
      })) as RecordEventResult;
      if (typeof result.version === "number") versionRef.current = result.version;
      console.debug(`${LOG_PREFIX} tryRecordEvent: %s accepted (version=%d, persistence=%s)`, input.clientEventId, result.version, result.persistenceStatus);
      return result;
    } catch (error) {
      const currentVersion = (error as { currentVersion?: unknown } | null)?.currentVersion;
      if (typeof currentVersion === "number") versionRef.current = currentVersion;
      const code = (error as { code?: string } | null)?.code ?? "unknown";
      console.warn(`${LOG_PREFIX} tryRecordEvent: %s failed (%s, realigned version=%d)`, input.clientEventId, code, versionRef.current);
      return null;
    }
  }

  return { ensureConnected, disconnect, reconnectNow, onLiveUpdate, tryRecordEvent };
}

export function createLeagueActions(
  matchId: string,
  realtime: ReturnType<typeof useLiveRealtime>,
): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startLiveSessionAction(matchId);
      if (result.success && result.data) {
        realtime.ensureConnected();
        return { success: true, data: { id: result.data.id } };
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
    // SPEC.md §28 primary/fallback decision flow: try the realtime path first (fast,
    // broadcasts to other connections as part of the same call); fall through to the
    // existing, byte-for-byte-unchanged HTTP path whenever realtime is unavailable, the RPC
    // throws, or the Durable Object accepted the event but couldn't confirm canonical
    // persistence yet (`persistenceStatus: "pending"` — calling HTTP too is safe and
    // idempotent per recordEventForActor's clientEventId dedup, and gives an immediate,
    // self-healing corrective write rather than waiting on Stage 6's alarm-based retry).
    recordEvent: async (input) => {
      const realtimeResult = await realtime.tryRecordEvent({
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
      if (realtimeResult?.persistenceStatus === "persisted") {
        return { success: true as const, data: {} };
      }

      const result = await recordLiveEventAction(input);
      if (result.success && result.data) {
        return { success: true as const, data: { id: result.data.eventId } };
      }
      return { success: false as const, error: result.success === false ? result.error : "Failed to record event" };
    },
    onLiveUpdate: realtime.onLiveUpdate,
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
  const realtime = useLiveRealtime(matchId);
  const leagueActions = createLeagueActions(matchId, realtime);

  return (
    <LiveMatchClient
      matchId={matchId}
      teamName={matchInfo.teamName}
      opponentName={matchInfo.opponent}
      contextLabel={matchInfo.roundName}
      periodConfig={getLeaguePeriodConfig(matchInfo.matchType)}
      actions={leagueActions}
    />
  );
}
