"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { LiveMatchActions, SquadPlayer, SerializedMatchFormat } from "@/components/live-match/live-match-client";
import type { LiveEventSummary, LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import { B08_MATCH_FORMAT, b08Squad, B08_LINEUP_STARTER_SLOTS } from "./fixture";
import { b08CanonicalLiveEvents } from "./fixture-history";

/**
 * B08-LIVE's own fixture-local `LiveMatchActions` — the one piece of real client state B08 needs
 * to survive a re-render within the LIVE page (a recorded event actually appears in the real
 * `LiveMatchClient`'s own event list after this hook's `recordEvent` resolves). Every action is
 * synchronous, in-memory, and never reaches a real network/persistence endpoint — the real
 * `LiveMatchClient` component itself is mounted unmodified; only this actions object is
 * fixture-local (see `docs/ui-lab/gate-b-w5-candidates/BLOCKERS.md` item #3, RESOLVED).
 */

export const B08_LIVE_SESSION_ID = "b08-fixture-session";
export const B08_LIVE_SERIALIZED_FORMAT: SerializedMatchFormat = {
  numberOfPeriods: B08_MATCH_FORMAT.numberOfPeriods,
  periodDurationMinutes: B08_MATCH_FORMAT.periodDurationMinutes,
  breakDurationMinutes: B08_MATCH_FORMAT.breakDurationMinutes,
};

/** Numeric `period` (1/2, as `MatchCanonicalLiveEventFact` stores it) back to the global
 * match-minute the fixture's own event list was authored against (`fixture-history.ts`'s own
 * 10'/22'/48' minute labels) — used only to decide which events are already "recorded" at the
 * LIVE snapshot instant, mirroring `B08_LIVE_NOW`'s own documented in-progress moment.
 * `matchSeconds` is real milliseconds (see `fixture.ts`'s `globalMinuteToPeriodRelative()` doc
 * comment) — divide by 60_000, not 60, to recover minutes. */
function toGlobalMinute(period: number | null, matchSeconds: number | null): number {
  return ((period ?? 1) - 1) * B08_MATCH_FORMAT.periodDurationMinutes + (matchSeconds ?? 0) / 60_000;
}

function periodNumberToKey(period: number | null): MatchPeriod {
  return (period ?? 1) >= 2 ? "SECOND_HALF" : "FIRST_HALF";
}

/** The LIVE snapshot's own in-progress instant (`B08_LIVE_NOW` = kickoff + 15' into the second
 * half = global minute 45) — strictly before the match's real 48' winner, so the reporter still
 * has real unfinished work ahead of them, not a relabeled final state. */
const B08_LIVE_CUTOFF_GLOBAL_MINUTE = 45;

function toSquadPlayers(): SquadPlayer[] {
  return b08Squad.map((member) => ({
    playerId: member.playerId,
    playerName: member.displayName,
    position: member.tacticalPosition,
    shirtNumber: member.shirtNumber,
    role: member.role,
    availability: "AVAILABLE",
    startingOnField: member.role === "starter" && B08_LINEUP_STARTER_SLOTS.includes(member.tacticalPosition as never),
    slotLabel: member.tacticalPosition,
  }));
}

function playerIdForName(playerName: string | null): string | null {
  if (!playerName) return null;
  return b08Squad.find((m) => m.displayName === playerName)?.playerId ?? null;
}

function toLiveEventSummary(fact: (typeof b08CanonicalLiveEvents)[number]): LiveEventSummary {
  return {
    id: fact.id,
    clientEventId: fact.clientEventId,
    eventType: fact.eventType as LiveMatchEventType,
    period: periodNumberToKey(fact.period),
    matchSeconds: fact.matchSeconds,
    wallClockTime: null,
    playerId: playerIdForName(fact.playerName),
    secondaryPlayerId: null,
    isCorrected: false,
    isReversed: false,
    correctsEventId: fact.correctsEventId,
    positionChange: null,
  };
}

const B08_LIVE_INITIAL_EVENTS: LiveEventSummary[] = b08CanonicalLiveEvents
  .filter((fact) => toGlobalMinute(fact.period, fact.matchSeconds) <= B08_LIVE_CUTOFF_GLOBAL_MINUTE)
  .map(toLiveEventSummary);

function generateFixtureEventId(): string {
  return `b08-live-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useB08LiveFixtureActions(matchId: string) {
  const [events, setEvents] = useState<LiveEventSummary[]>(B08_LIVE_INITIAL_EVENTS);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const recordEvent = useCallback<LiveMatchActions["recordEvent"]>(async (input) => {
    const id = generateFixtureEventId();
    setEvents((prev) => [
      ...prev,
      {
        id,
        clientEventId: input.clientEventId,
        eventType: input.eventType as LiveMatchEventType,
        period: (input.period as MatchPeriod) ?? "SECOND_HALF",
        matchSeconds: input.matchSeconds ?? null,
        wallClockTime: new Date(),
        playerId: input.playerId ?? null,
        secondaryPlayerId: input.secondaryPlayerId ?? null,
        isCorrected: false,
        isReversed: false,
        correctsEventId: input.correctsEventId ?? null,
        positionChange: null,
      },
    ]);
    return { success: true, data: { id } };
  }, []);

  const actions = useMemo<LiveMatchActions>(
    () => ({
      startSession: async () => ({
        success: true,
        data: { id: B08_LIVE_SESSION_ID, startedAt: new Date().toISOString(), format: B08_LIVE_SERIALIZED_FORMAT },
      }),
      endSession: async () => ({ success: true, data: { reportId: "report-gate-b-08", reportStatus: "REPORTED" } }),
      heartbeat: async () => {},
      recordEvent,
      getRecentEvents: async () => ({ success: true, data: eventsRef.current }),
      getPreMatchPackage: async () => {
        const now = Date.now();
        // B08 W5 remediation (independent review, finding P1-2): `getElapsedMs()`
        // (`src/lib/live-match/match-clock.ts`) computes `elapsedBeforeStartMs + (now -
        // startedAt)` — `elapsedBeforeStartMs` is time accumulated *within the current period*
        // before the clock's current unbroken run, not the duration of any earlier period. The
        // second half has been running continuously since kickoff + 40' real time (30' first
        // half + 10' break) with no pause, so its own elapsedBeforeStartMs is 0 — the previous
        // `30 * 60 * 1000` here double-counted the completed first half on top of the real 15'
        // already elapsed in the second, producing a false ~45:00 reading and a spurious
        // over-duration warning against the real 30'-period format.
        const secondHalfElapsedMs = (B08_LIVE_CUTOFF_GLOBAL_MINUTE - B08_MATCH_FORMAT.periodDurationMinutes) * 60_000;
        const secondHalfStartedAt = new Date(now - secondHalfElapsedMs).toISOString();
        const realWorldSessionStartMs =
          (B08_MATCH_FORMAT.periodDurationMinutes + B08_MATCH_FORMAT.breakDurationMinutes + (B08_LIVE_CUTOFF_GLOBAL_MINUTE - B08_MATCH_FORMAT.periodDurationMinutes)) *
          60_000;
        return {
          success: true,
          data: {
            squad: toSquadPlayers(),
            activeSession: {
              id: B08_LIVE_SESSION_ID,
              coachId: "coach-gate-b-08",
              startedAt: new Date(now - realWorldSessionStartMs).toISOString(),
              format: B08_LIVE_SERIALIZED_FORMAT,
              clock: { period: "SECOND_HALF", running: true, startedAt: secondHalfStartedAt, elapsedBeforeStartMs: 0 },
              lastClockTransitionAt: secondHalfStartedAt,
            },
          },
        };
      },
      reportUrl: () => `/dev/ui-lab/gate-b/b08-information-ownership/report-draft`,
      // No `persistClock`/`onLiveUpdate`/`reconnectRealtime`/`onPersistenceChanged` — all
      // optional, and genuinely absent here: this fixture never reaches a realtime coordinator
      // (see BLOCKERS.md item #3), matching the real Event adapter's own "no coordinator
      // involvement" shape rather than inventing a fake one.
    }),
    [recordEvent],
  );

  return { actions, events, matchId };
}
