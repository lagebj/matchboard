"use client";

/**
 * Read-only "Follow live" viewer (ADR-0086 amendment). Deliberately minimal and one-way: it
 * only ever calls `getSnapshot()` and registers callback handlers for server→browser
 * broadcasts — it never calls `recordEvent`/`endSession`, and has no editing controls of any
 * kind. Server-side enforcement (the "view" ticket's capabilities, checked by
 * `workers/live-match/src/match-session-object.ts`) is the real boundary; this component's
 * read-only-ness is defense in depth, not the security mechanism.
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

interface FollowLiveClientProps {
  matchId: string;
  teamName: string;
  opponentName: string;
  homeAway: string;
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

export function FollowLiveClient({ matchId, teamName, opponentName, homeAway }: FollowLiveClientProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("connecting");
  const [connectedCount, setConnectedCount] = useState(0);
  const [events, setEvents] = useState<CanonicalLiveEvent[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clientRef = useRef<RealtimeMatchClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL;
    if (!url) {
      setConnectionState("error");
      return;
    }

    const client = new RealtimeMatchClient({
      url: `${url}/matches/${matchId}`,
      clientId: crypto.randomUUID(),
      getTicket: () => fetchRealtimeTicket(matchId, "view"),
      onConnectionStateChange: setConnectionState,
      callbackHandlers: {
        applyEvent: (raw): ClientAck => {
          const params = raw as ApplyEventCallback;
          setEvents((prev) => [params.event, ...prev].slice(0, 50));
          return { acknowledged: true };
        },
        presenceChanged: (raw): ClientAck => {
          const params = raw as PresenceChangedCallback;
          setConnectedCount(params.connectedCount);
          return { acknowledged: true };
        },
        sessionEnded: (_raw): ClientAck => {
          setSessionEnded(true);
          return { acknowledged: true };
        },
      },
    });

    clientRef.current = client;
    void client.connect().then(async () => {
      try {
        const snapshot = (await client.getSnapshot()) as MatchSessionSnapshot;
        setConnectedCount(snapshot.presence.connectedCount);
        if (snapshot.session.status === "ENDED") setSessionEnded(true);
      } catch {
        // Snapshot fetch failing doesn't prevent later broadcasts from arriving — the
        // connection-state indicator already communicates degraded state to the coach.
      }
    });

    return () => {
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
            {events.map((event) => (
              <li key={event.id} className="text-sm text-zinc-300">
                {event.eventType.replaceAll("_", " ").toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
