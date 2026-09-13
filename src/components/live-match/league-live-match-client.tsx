"use client";

import { useCallback, useEffect, useRef } from "react";
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
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";
import type { MatchType } from "@/generated/prisma/client";
import { RealtimeMatchClient } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import type {
  RecordEventResult,
  ApplyEventCallback,
  PresenceChangedCallback,
  PersistenceChangedCallback,
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

type PersistenceStatus = "pending" | "persisted" | "failed_terminal" | "failed_exhausted";

const LOG_PREFIX = "[live-match:league-realtime]";

/**
 * Realtime integration for the reporting coach (SPEC.md §5, §20, §22, §27, §28 — Stage 5;
 * ADR-0138 Bundle 4 for the current write-path exclusivity). When connected and authenticated
 * with `"report"` capability, `MatchSession.recordEvent()` is the *only* normal path a new live
 * operation is canonically ordered through — `tryRecordEvent()` is attempted, and its result
 * (persisted, pending, or unavailable) is final; `createLeagueActions.recordEvent` never falls
 * through to an independent HTTP canonical write. This closes ARR-0045 (dual canonical write
 * path): before Bundle 4, an unavailable/pending realtime result fell through to
 * `recordLiveEventAction`, a plain HTTP server action with no coordinator involvement — a
 * second, independently-ordered canonical writer. When the coordinator is genuinely
 * unavailable, the command stays in the local outbox (already durably saved to IndexedDB
 * before this function is ever called — see `live-match-client.tsx`'s `recordEventLocal`) and
 * is retried via the same `recordEvent` function on the next reconnect
 * (`syncUnsyncedEvents`) — never via an alternate ordering authority (DECISIONS.md D03/D12).
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
  // ADR-0138 Bundle 6 — subscribers to `eventPersistenceChanged` broadcasts, distinct from
  // `listenersRef` (a generic "something changed, refresh" signal) since persistence-changed
  // callbacks carry a specific (clientEventId, persistenceStatus) payload the local outbox needs.
  const persistenceListenersRef = useRef<Set<(clientEventId: string, persistenceStatus: PersistenceStatus) => void>>(new Set());
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
        eventPersistenceChanged: (raw) => {
          const params = raw as PersistenceChangedCallback;
          console.debug(`${LOG_PREFIX} persistence changed: %s -> %s`, params.clientEventId, params.persistenceStatus);
          for (const listener of persistenceListenersRef.current) listener(params.clientEventId, params.persistenceStatus);
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

  function onPersistenceChanged(callback: (clientEventId: string, persistenceStatus: PersistenceStatus) => void): () => void {
    persistenceListenersRef.current.add(callback);
    return () => persistenceListenersRef.current.delete(callback);
  }

  /**
   * The only write path (ADR-0138 Bundle 4). Returns `null` when realtime isn't
   * connected/authenticated or the RPC call itself fails/rejects (including a `STALE_STATE`
   * rejection for a state-sensitive event) — in every `null` case the caller
   * (`createLeagueActions.recordEvent`) leaves the command unsynchronized in the local outbox
   * rather than persisting it through an independent HTTP write. `clientEventId` dedup
   * (`recordEventForActor`, Stage 4) still guarantees at most one canonical Neon row even if a
   * later retry races a delayed response from an earlier attempt.
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

  return { ensureConnected, disconnect, reconnectNow, onLiveUpdate, onPersistenceChanged, tryRecordEvent };
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
    // RPC failed (`tryRecordEvent` returned `null`), the command is left unsynchronized rather
    // than persisted through an alternate ordering authority — it stays safely in the local
    // outbox (already durably saved before this function is called) and is retried through
    // this same function on the next reconnect.
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
      if (realtimeResult) {
        return { success: true as const, data: { persistenceStatus: realtimeResult.persistenceStatus } };
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
      isHome={matchInfo.homeAway === "HOME"}
      subjectType="LEAGUE"
    />
  );
}
