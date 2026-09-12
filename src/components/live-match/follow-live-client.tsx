"use client";

/**
 * Read-only "Follow live" viewer (ADR-0086 amendment, ADR-0112 consistency).
 *
 * Derives ALL observable live-match state (score, clock, on-field players,
 * recent events) from the canonical LiveMatchProjection — the same projection
 * the Live Reporting client uses. No separate score/clock/player state is
 * maintained here.
 *
 * This component NEVER calls recordEvent/endSession and has NO mutation
 * controls. The "view" capability on the realtime ticket is enforced
 * server-side by the Durable Object; this component's read-only-ness is
 * defense in depth.
 *
 * Hydration flow (ADR-0112):
 * 1. Connect to realtime, authenticate with "view" ticket.
 * 2. Call getSnapshot() to load authoritative session state.
 * 3. Hydrate projection from snapshot.events + snapshot.clock.
 * 4. Apply realtime applyEvent callbacks on top.
 * 5. On refresh/reconnect, re-derive everything from the fresh snapshot.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Users, WifiOff } from "lucide-react";
import { RealtimeMatchClient, type RealtimeConnectionState } from "@/lib/live-match/realtime/realtime-client";
import { fetchRealtimeTicket } from "@/lib/live-match/realtime/fetch-ticket";
import type {
  MatchSessionSnapshot,
  ApplyEventCallback,
  PresenceChangedCallback,
  CanonicalLiveEvent,
  ClientAck,
} from "@/lib/live-match/realtime/realtime-messages";
import { MatchScoreHeader, StatusText } from "@/components/touchline";
import { TouchlineTimeline, TimelineItem } from "@/components/touchline/timeline/touchline-timeline";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import {
  projectCanonicalLiveState,
  clockProjectionToClockState,
  mergeSnapshotWithRealtimeEvents,
  canonicalEventToSummary,
  type LiveMatchProjectionState,
  type LiveMatchBaseline,
} from "@/lib/live-match/live-match-projection";
import {
  createInitialClockState,
  getElapsedMs,
  formatElapsedMs,
} from "@/lib/live-match/match-clock";
import type { MatchClockState } from "@/lib/live-match/live-match-types";
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";

const LOG_PREFIX = "[live-match:follow]";

interface FollowLiveClientProps {
  matchId: string;
  teamName: string;
  opponentName: string;
  homeAway: string;
  /** playerId → playerName mapping for resolving player names in live event display. */
  playerMap: Record<string, string>;
  /** Baseline squad (pre-match roster with startingOnField) for projecting on-field players. */
  squad: { playerId: string; playerName: string; startingOnField: boolean; isActiveParticipant?: boolean }[];
  /** Match type for period config. Defaults to LEAGUE (regulation only). */
  matchType?: "LEAGUE" | "CUP" | "FRIENDLY" | "DEVELOPMENT";
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

export function FollowLiveClient({
  matchId,
  teamName,
  opponentName,
  homeAway,
  playerMap,
  squad,
  matchType = "LEAGUE",
}: FollowLiveClientProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("connecting");
  const [connectedCount, setConnectedCount] = useState(0);
  const [projection, setProjection] = useState<LiveMatchProjectionState | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const clientRef = useRef<RealtimeMatchClient | null>(null);
  const realtimeEventsRef = useRef<CanonicalLiveEvent[]>([]);
  const lastAppliedVersionRef = useRef(0);
  const baselineRef = useRef<LiveMatchBaseline | null>(null);

  // Build baseline once from props
  if (!baselineRef.current) {
    baselineRef.current = {
      squad: squad.map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        position: null,
        shirtNumber: null,
        role: p.isActiveParticipant === false ? "UNAVAILABLE" : "CORE",
        availability: p.isActiveParticipant === false ? "UNAVAILABLE" : "AVAILABLE",
        startingOnField: p.startingOnField,
        slotLabel: null,
        isActiveParticipant: p.isActiveParticipant !== false,
      })),
      activeSession: null, // will be populated from snapshot
    };
  }

  const baseline = baselineRef.current;
  const periodConfig = getLeaguePeriodConfig(matchType);

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
        console.debug(`${LOG_PREFIX} connection state: %s`, state);
        setConnectionState(state);
      },
      callbackHandlers: {
        applyEvent: (raw): ClientAck => {
          const params = raw as ApplyEventCallback;
          console.debug(`${LOG_PREFIX} event received: %s (version=%d)`, params.event.eventType, params.version);

          // Add event to realtime buffer
          realtimeEventsRef.current = [...realtimeEventsRef.current, params.event];

          // Update version tracking
          if (params.version > lastAppliedVersionRef.current) {
            lastAppliedVersionRef.current = params.version;
          }

          // Recompute projection with latest events
          // Use the current snapshot clock (if we have one) plus all accumulated events
          setProjection((prev) => {
            if (!baseline) return prev;
            const allEvents = prev
              ? mergeSnapshotWithRealtimeEvents(
                  prev.recentEvents,
                  prev.version,
                  realtimeEventsRef.current,
                  lastAppliedVersionRef.current,
                )
              : realtimeEventsRef.current;
            // Keep the clock anchor from the existing projection (it's more recent than nothing)
            const clockAnchor = prev?.clock
              ? { period: prev.clock.period, running: prev.clock.running, matchSecondsAtAnchor: prev.clock.elapsedAtAnchorMs, anchorServerTimeMs: prev.clock.anchorServerTimeMs }
              : null;
            return projectCanonicalLiveState(baseline, allEvents, clockAnchor, prev?.session?.status ?? "ACTIVE", params.version);
          });

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
          setProjection((prev) => prev ? { ...prev, session: { status: "ENDED" } } : prev);
          return { acknowledged: true };
        },
      },
    });

    clientRef.current = client;
    void client.connect().then(async () => {
      try {
        const snapshot = (await client.getSnapshot()) as MatchSessionSnapshot;
        console.debug(`${LOG_PREFIX} snapshot received: version=%d, events=%d, status=%s`, snapshot.version, snapshot.events.length, snapshot.session.status);

        // Reset version tracking to snapshot version
        lastAppliedVersionRef.current = snapshot.version;

        // Clear realtime buffer — snapshot is authoritative up to this version
        realtimeEventsRef.current = [];

        // Recompute projection from snapshot
        if (baseline) {
          const newProjection = projectCanonicalLiveState(
            baseline,
            snapshot.events,
            snapshot.clock,
            snapshot.session.status,
            snapshot.version,
          );
          setProjection(newProjection);
        }

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

  // Derived display values
  const clockState: MatchClockState = useMemo(() => {
    if (!projection) return createInitialClockState();
    return clockProjectionToClockState(projection.clock);
  }, [projection]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!projection?.clock.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [projection?.clock.running]);

  const elapsedMs = projection?.clock.running
    ? getElapsedMs(clockState, now)
    : projection
      ? getElapsedMs(clockState, Date.now())
      : 0;

  const periodLabel = periodConfig.find((p) => p.key === clockState.period)?.label ?? clockState.period.replace(/_/g, " ");

  const onFieldPlayers = useMemo(() => {
    if (!projection) return [];
    return projection.onField.playerIds
      .map((id) => ({ id, name: playerMap[id] ?? "Unknown" }))
      .filter((p) => p.name !== "Unknown");
  }, [projection, playerMap]);

  const eventSummaries = useMemo(() => {
    if (!projection) return [];
    return projection.recentEvents.map((event) => canonicalEventToSummary(event, playerMap));
  }, [projection, playerMap]);

  const isConnected = connectionState === "connected";

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134).
    // Read-only "Follow live" scoreboard grammar (bundle 06 §11 map).
    <div className="touchline flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Follow live
          </p>
          <h1 className="mt-0.5 truncate text-[24px] font-[650] leading-tight text-[var(--foreground)]">
            {teamName} {homeAway === "HOME" ? "vs" : "@"} {opponentName}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
          <StatusText tone={isConnected ? "live" : "neutral"} dot={isConnected} strong>
            {isConnected ? "LIVE" : CONNECTION_LABEL[connectionState]}
          </StatusText>
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {connectedCount}
          </span>
        </div>
      </div>

      {sessionEnded && (
        <p className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] p-4 text-[13px] text-[var(--text-soft)]">
          This live session has ended.
        </p>
      )}

      {connectionState === "error" && (
        <p className="flex items-center gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] p-4 text-[13px] text-[var(--text-muted)]">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Live following isn&apos;t available right now.
        </p>
      )}

      {/* Scoreboard — canonical match-header grammar, derived from the projection.
          Read-only: no mutation controls, matching Live Reporting's header shape. */}
      {projection && (
        <MatchScoreHeader
          framed
          presentation={buildMatchPresentation({
            id: matchId,
            teamName,
            opponentName,
            isHome: homeAway === "HOME",
            lifecycleStatus: "live",
            ownGoals: projection.score.goalsFor,
            opponentGoals: projection.score.goalsAgainst,
            liveClockLabel: `${periodLabel} · ${formatElapsedMs(elapsedMs)}`,
          })}
        />
      )}

      {/* On-field players — derived from projection */}
      {onFieldPlayers.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-[620] text-[var(--foreground)]">On field</h2>
            <span className="text-[12px] text-[var(--text-muted)]">{onFieldPlayers.length} players</span>
          </div>
          <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {onFieldPlayers.map((p) => (
              <li key={p.id} className="py-2.5 text-[15px] font-[600] text-[var(--foreground)]">
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Match events — derived from projection. Touchline Design Atlas (ADR-0136, Phase 5):
          the shared `TouchlineTimeline` primitive (already used by Today, Rotations) replaces
          the previous flat divide-y list -- purely presentational, read-only, no mutation
          control (this component never calls recordEvent/endSession, matching AGENTS.md's
          "Follow live" boundary). The most recent event is the "current" node; every earlier
          one is "done". */}
      <section>
        <h2 className="text-[18px] font-[620] text-[var(--foreground)]">Match events</h2>
        {eventSummaries.length === 0 && !projection ? (
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Connecting to live match…</p>
        ) : eventSummaries.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">
            No events yet — updates will appear here as they happen.
          </p>
        ) : (
          <div className="mt-2">
            <TouchlineTimeline aria-label="Live match events">
              {eventSummaries.map((summary, i) => (
                <TimelineItem
                  key={summary.id}
                  timeLabel={summary.matchClock ?? null}
                  kicker={!summary.matchClock ? summary.period : null}
                  state={i === eventSummaries.length - 1 ? "current" : "done"}
                  isLast={i === eventSummaries.length - 1}
                >
                  <p className="text-[14px] text-[var(--text-soft)]">{summary.text}</p>
                </TimelineItem>
              ))}
            </TouchlineTimeline>
          </div>
        )}
      </section>
    </div>
  );
}