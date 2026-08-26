"use client";

/**
 * Read-only "Follow live" viewer (ADR-0086 amendment). Deliberately minimal and one-way: it
 * only ever calls `getSnapshot()` and registers callback handlers for server→browser
 * broadcasts — it never calls `recordEvent`/`endSession`, and has no editing controls of any
 * kind. Server-side enforcement (the "view" ticket's capabilities, checked by
 * `workers/live-match/src/match-session-object.ts`) is the real boundary; this component's
 * read-only-ness is defense in depth, not the security mechanism.
 *
 * Diagnostic logging uses `console.warn`/`console.error` for failure states so they appear in
 * browser consoles even when debug-level filtering is active. `console.debug` is used for
 * informational connection lifecycle events.
 */

import { useEffect, useRef, useState } from "react";
import { Tv, Users, WifiOff } from "lucide-react";
import { RealtimeMatchClient, type RealtimeConnectionState } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import type {
  MatchSessionSnapshot,
  ApplyEventCallback,
  PresenceChangedCallback,
  CanonicalLiveEvent,
  ClientAck,
} from "@/lib/live-match/realtime/realtime-messages";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";

import { getEventTypeLabel } from "@/lib/live-match/live-match-domain";
import type { LiveMatchEventType } from "@/lib/live-match/live-match-types";

const LOG_PREFIX = "[live-match:follow]";

interface FollowLiveClientProps {
  matchId: string;
  teamName: string;
  opponentName: string;
  homeAway: string;
  /** playerId → playerName mapping for resolving player names in live event display. */
  playerMap: Record<string, string>;
}

const CONNECTION_LABEL: Record<RealtimeConnectionState, string> = {
  disabled: "Not connected",
  connecting: "Connecting…",
  authenticating: "Connecting…",
  connected: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
  error: "Connection problem",
};

export function FollowLiveClient({ matchId, teamName, opponentName, homeAway, playerMap }: FollowLiveClientProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("connecting");
  const [connectedCount, setConnectedCount] = useState(0);
  const [events, setEvents] = useState<CanonicalLiveEvent[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clientRef = useRef<RealtimeMatchClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL;
    if (!url) {
      console.error(`${LOG_PREFIX} NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL is not set — cannot connect.`);
      setConnectionState("error");
      return;
    }

    console.debug(`${LOG_PREFIX} initializing client (matchId=%s, url=%s)`, matchId, url);

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: crypto.randomUUID(),
      getTicket: () => fetchRealtimeTicket(matchId, "view"),
      onConnectionStateChange: (state) => {
        console.debug(`${LOG_PREFIX} connection state: %s → %s`, connectionState, state);
        setConnectionState(state);
      },
      callbackHandlers: {
        applyEvent: (raw): ClientAck => {
          const params = raw as ApplyEventCallback;
          console.debug(`${LOG_PREFIX} event received: %s (version=%d)`, params.event.eventType, params.version);
          setEvents((prev) => [params.event, ...prev].slice(0, 50));
          return { acknowledged: true };
        },
        presenceChanged: (raw): ClientAck => {
          const params = raw as PresenceChangedCallback;
          console.debug(`${LOG_PREFIX} presence changed: connectedCount=%d`, params.connectedCount);
          setConnectedCount(params.connectedCount);
          return { acknowledged: true };
        },
        sessionEnded: (_raw): ClientAck => {
          console.warn(`${LOG_PREFIX} session ended by server`);
          setSessionEnded(true);
          return { acknowledged: true };
        },
      },
    });

    clientRef.current = client;
    void client.connect().then(async () => {
      try {
        const snapshot = (await client.getSnapshot()) as MatchSessionSnapshot;
        console.debug(`${LOG_PREFIX} snapshot received: version=%d, events=%d, status=%s`, snapshot.version, snapshot.events.length, snapshot.session.status);
        setConnectedCount(snapshot.presence.connectedCount);
        if (snapshot.session.status === "ENDED") setSessionEnded(true);
      } catch (error) {
        console.warn(`${LOG_PREFIX} snapshot fetch failed (non-fatal): %s`, error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      console.debug(`${LOG_PREFIX} cleanup: disconnecting`);
      client.disconnect();
      clientRef.current = null;
    };
  }, [matchId]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${teamName} vs ${opponentName}`}
        description={`Following live · ${homeAway === "HOME" ? "Home" : "Away"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill variant={connectionState === "connected" ? "success" : "neutral"}>
              {CONNECTION_LABEL[connectionState]}
            </StatusPill>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {connectedCount}
            </span>
          </div>
        }
      />

      {sessionEnded && (
        <Surface className="p-4 text-sm text-zinc-300">This live session has ended.</Surface>
      )}

      {connectionState === "error" && (
        <Surface className="flex items-center gap-2 p-4 text-sm text-zinc-400">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Live following isn&apos;t available right now.
        </Surface>
      )}

      <Surface className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
          <Tv className="h-4 w-4" aria-hidden="true" />
          Recent activity
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No events yet — updates will appear here as they happen.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => {
              const label = getEventTypeLabel(event.eventType as LiveMatchEventType);
              const playerName = event.playerId ? playerMap[event.playerId] : undefined;
              const secondaryName = event.secondaryPlayerId ? playerMap[event.secondaryPlayerId] : undefined;
              let text = label;
              if (playerName && secondaryName) {
                text = `${label} — ${playerName} / ${secondaryName}`;
              } else if (playerName) {
                text = `${label} — ${playerName}`;
              }
              return (
                <li key={event.id} className="text-sm text-zinc-300">
                  {text}
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </div>
  );
}
