"use client";

import { useCallback, useEffect, useRef } from "react";
import { RealtimeMatchClient } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import { isConflictCode, type ConflictCode } from "@/lib/live-match/realtime/protocol";
import type {
  RecordEventResult,
  ApplyEventCallback,
  PresenceChangedCallback,
  PersistenceChangedCallback,
  ClientAck,
} from "@/lib/live-match/realtime/realtime-messages";

function ack(): ClientAck {
  return { acknowledged: true };
}

type PersistenceStatus = "pending" | "persisted" | "failed_terminal" | "failed_exhausted";

/**
 * ADR-0138 Bundle 8 — the outcome of one `tryRecordEvent` attempt, distinguishing a genuine
 * coordinator-detected conflict (Bundle 3's `conflictCode`, carried on the `STALE_STATE` wire
 * error) from a plain connectivity/transport failure. Only a conflict should ever move a
 * command to `NEEDS_REVIEW` — a transport failure must keep retrying as `LOCAL_PENDING`
 * (DECISIONS.md D03/D12: never silently give up on a coach's recorded intent).
 */
export interface TryRecordEventOutcome {
  result: RecordEventResult | null;
  /** Present only when the coordinator rejected this exact operation with a real, actionable
   * semantic-precondition failure — never for "not connected" or an unrecognized/transport
   * error, which return `conflict: undefined` so the caller retries normally. */
  conflict?: { code?: ConflictCode; message: string };
}

/**
 * Shared realtime coordinator integration (SPEC.md §5, §20, §22, §27, §28 — Stage 5; ADR-0138
 * Bundle 4 for write-path exclusivity; Bundle 8 for League/Event parity). Originally
 * League-only (`league-live-match-client.tsx`'s `useLiveRealtime`) — extracted here, unchanged
 * in behavior, and parameterized by `subjectType` so `event-live-match-client.tsx` reuses the
 * exact same coordinator-connection logic rather than a second, independently-maintained copy
 * (AGENTS.md's "One business operation, one owning implementation, multiple adapters" — the
 * Prisma persistence tables stay separate per D19, but this client-side orchestration is not a
 * persistence concern and has no reason to duplicate). Closes the League/Event asymmetry ARR-0046
 * documented: before this, `createEventActions` had no realtime connection at all.
 *
 * When connected and authenticated with `"report"` capability, `MatchSession.recordEvent()` is
 * the *only* normal path a new live operation is canonically ordered through —
 * `tryRecordEvent()` is attempted, and its result (persisted, pending, or unavailable) is final;
 * the caller (`createLeagueActions`/`createEventActions`) never falls through to an independent
 * HTTP canonical write. When the coordinator is genuinely unavailable, the command stays in the
 * local outbox (already durably saved to IndexedDB before this function is ever called) and is
 * retried via the same `recordEvent` function on the next reconnect (`syncUnsyncedEvents`) —
 * never via an alternate ordering authority (DECISIONS.md D03/D12).
 *
 * `applyEvent`/`presenceChanged`/`sessionEnded` broadcasts (including ones triggered by a
 * *second* reporter on the same match, SPEC.md §44 scenario 2) fire `notifyListeners()`, which
 * `LiveMatchActions.onLiveUpdate` exposes to `LiveMatchClient` so it can refresh immediately
 * rather than waiting for its own 5s poll.
 */
export function useLiveRealtime(matchId: string, subjectType: "LEAGUE" | "EVENT" = "LEAGUE") {
  const logPrefix = `[live-match:${subjectType === "EVENT" ? "event" : "league"}-realtime]`;
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
      console.debug(`${logPrefix} NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL not set — realtime disabled (kill switch)`);
      return;
    }

    console.debug(`${logPrefix} connecting (matchId=%s, url=%s)`, matchId, url);

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: clientIdRef.current,
      getTicket: () => fetchRealtimeTicket(matchId, "report", subjectType),
      onConnectionStateChange: (state) => {
        if (state !== "connected") return;
        console.debug(`${logPrefix} connected, fetching snapshot`);
        client
          .getSnapshot()
          .then((snapshot) => {
            const version = (snapshot as { version?: unknown } | undefined)?.version;
            if (typeof version === "number") versionRef.current = version;
            console.debug(`${logPrefix} snapshot received (version=%d)`, versionRef.current);
            notifyListeners();
          })
          .catch((error) => {
            console.warn(`${logPrefix} snapshot fetch failed (non-fatal): %s`, error instanceof Error ? error.message : String(error));
          });
      },
      callbackHandlers: {
        applyEvent: (raw) => {
          const params = raw as ApplyEventCallback;
          console.debug(`${logPrefix} broadcast received: %s (version=%d)`, params.event.eventType, params.version);
          notifyListeners();
          return ack();
        },
        presenceChanged: (raw) => {
          const params = raw as PresenceChangedCallback;
          console.debug(`${logPrefix} presence changed: connectedCount=%d`, params.connectedCount);
          notifyListeners();
          return ack();
        },
        sessionEnded: (_raw) => {
          console.warn(`${logPrefix} session ended by server`);
          notifyListeners();
          return ack();
        },
        eventPersistenceChanged: (raw) => {
          const params = raw as PersistenceChangedCallback;
          console.debug(`${logPrefix} persistence changed: %s -> %s`, params.clientEventId, params.persistenceStatus);
          for (const listener of persistenceListenersRef.current) listener(params.clientEventId, params.persistenceStatus);
          return ack();
        },
      },
    });
    clientRef.current = client;
    void client.connect().catch((error) => {
      console.error(`${logPrefix} connect failed: %s`, error instanceof Error ? error.message : String(error));
      clientRef.current = null;
    });
  }

  function disconnect(): void {
    console.debug(`${logPrefix} disconnecting`);
    clientRef.current?.disconnect();
    clientRef.current = null;
  }

  /** Force an immediate reconnect attempt, bypassing the client's own backoff timer (SPEC.md
   * §27: "on browser online... reconnect" — a passive timer could otherwise leave the coach
   * on HTTP-only for up to ~30s after connectivity actually returns).
   *
   * ADR-0138 Bundle 7 fix: this used to no-op when no connection had ever been attempted on
   * this component mount — correct for the original "an existing connection dropped, get it
   * back" scenario, but a real bug for a mount that *restores* an already-active session
   * without ever calling `startSession` (a fresh page reload of an in-progress session, and
   * Bundle 7's offline-continuation shell in particular): `ensureConnected()` was previously
   * only ever called from `startSession`'s own success handler, so a restored session's
   * `clientRef.current` stayed `null` forever, and every subsequent `online` event's
   * `reconnectRealtime()` call was a silent no-op — commands recorded against a restored
   * session never synced even once the network genuinely returned, confirmed live via
   * `e2e/live-reporting-offline-continuation.spec.ts` hanging on `waitForEventsToSync`. Falls
   * through to `ensureConnected()` (idempotent — its own first line already no-ops if a
   * connection exists) when nothing has connected yet, rather than staying a silent no-op. */
  function reconnectNow(): void {
    if (!clientRef.current) {
      console.debug(`${logPrefix} reconnectNow: no connection ever attempted on this mount — establishing one now`);
      ensureConnected();
      return;
    }
    console.debug(`${logPrefix} reconnectNow: forcing immediate reconnect`);
    void clientRef.current.connect();
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
   * (`createLeagueActions.recordEvent`/`createEventActions.recordEvent`) leaves the command
   * unsynchronized in the local outbox rather than persisting it through an independent HTTP
   * write. `clientEventId` dedup (`recordEventForActor`/`recordEventForActorEvent`, Stage 4)
   * still guarantees at most one canonical Neon row even if a later retry races a delayed
   * response from an earlier attempt.
   */
  async function tryRecordEvent(input: {
    clientEventId: string;
    event: Record<string, unknown>;
  }): Promise<TryRecordEventOutcome> {
    const client = clientRef.current;
    if (!client || client.connectionState !== "connected") return { result: null };

    try {
      const result = (await client.recordEvent({
        clientEventId: input.clientEventId,
        baseVersion: versionRef.current,
        event: input.event,
      })) as RecordEventResult;
      if (typeof result.version === "number") versionRef.current = result.version;
      console.debug(`${logPrefix} tryRecordEvent: %s accepted (version=%d, persistence=%s)`, input.clientEventId, result.version, result.persistenceStatus);
      return { result };
    } catch (error) {
      const currentVersion = (error as { currentVersion?: unknown } | null)?.currentVersion;
      if (typeof currentVersion === "number") versionRef.current = currentVersion;
      const code = (error as { code?: string } | null)?.code ?? "unknown";
      console.warn(`${logPrefix} tryRecordEvent: %s failed (%s, realigned version=%d)`, input.clientEventId, code, versionRef.current);

      // ADR-0138 Bundle 3/8 — `STALE_STATE` is the one wire error code the coordinator uses for
      // a genuine, actionable semantic-precondition rejection (never a plain connectivity/
      // transport failure, which arrives as `PERSISTENCE_UNAVAILABLE`/`SESSION_NOT_FOUND`/an
      // unknown error and must keep retrying as LOCAL_PENDING instead). `conflictCode` is the
      // fine-grained, machine-readable reason (Bundle 3); its absence on an older worker still
      // surfaces a genuine conflict with a generic message rather than being silently retried.
      if (code === "STALE_STATE") {
        const rawConflictCode = (error as { conflictCode?: unknown } | null)?.conflictCode;
        const message = (error as { message?: string } | null)?.message ?? "The coordinator rejected this action.";
        return {
          result: null,
          conflict: { code: isConflictCode(rawConflictCode) ? rawConflictCode : undefined, message },
        };
      }

      return { result: null };
    }
  }

  return { ensureConnected, disconnect, reconnectNow, onLiveUpdate, onPersistenceChanged, tryRecordEvent };
}
