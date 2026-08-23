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
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";
import { RealtimeMatchClient } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import type {
  RecordEventResult,
  ApplyEventCallback,
  PresenceChangedCallback,
  SessionEndedCallback,
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
  };
}

function ack(): ClientAck {
  return { acknowledged: true };
}

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
    if (!url) return; // No realtime endpoint configured — silently no-op (kill switch, ADR-0086).

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: clientIdRef.current,
      getTicket: () => fetchRealtimeTicket(matchId, "report"),
      // SPEC.md §27 reconnect sequence step 4 ("get snapshot") — re-derive the current
      // version on (re)connect rather than trusting whatever this tab last knew, then prompt
      // an immediate refresh (step 5's "replay unsynced local events" is handled separately,
      // by the existing syncUnsyncedEvents() flow in live-match-client.tsx, which now goes
      // through tryRecordEvent too since it also calls actions.recordEvent).
      onConnectionStateChange: (state) => {
        if (state !== "connected") return;
        client
          .getSnapshot()
          .then((snapshot) => {
            const version = (snapshot as { version?: unknown } | undefined)?.version;
            if (typeof version === "number") versionRef.current = version;
            notifyListeners();
          })
          .catch(() => {
            // Non-fatal — the connection is still usable; the next recordEvent's own
            // response (or a STALE_STATE rejection) will realign the version instead.
          });
      },
      callbackHandlers: {
        applyEvent: (raw) => {
          void (raw as ApplyEventCallback);
          notifyListeners();
          return ack();
        },
        presenceChanged: (raw) => {
          void (raw as PresenceChangedCallback);
          notifyListeners();
          return ack();
        },
        sessionEnded: (raw) => {
          void (raw as SessionEndedCallback);
          notifyListeners();
          return ack();
        },
      },
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

  /** Force an immediate reconnect attempt, bypassing the client's own backoff timer (SPEC.md
   * §27: "on browser online... reconnect" — a passive timer could otherwise leave the coach
   * on HTTP-only for up to ~30s after connectivity actually returns). No-op if never
   * connected in the first place (nothing to reconnect). */
  function reconnectNow(): void {
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
      return result;
    } catch (error) {
      // STALE_STATE carries the object's actual current version — realign now so the *next*
      // state-sensitive attempt doesn't repeat the same rejection forever (a hardcoded/stale
      // baseVersion would otherwise only ever succeed once, per the same self-heal reasoning
      // this file already documented for the old best-effort broadcast).
      const currentVersion = (error as { currentVersion?: unknown } | null)?.currentVersion;
      if (typeof currentVersion === "number") versionRef.current = currentVersion;
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
      periodConfig={LEAGUE_PERIOD_CONFIG}
      actions={leagueActions}
    />
  );
}
