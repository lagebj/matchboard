"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { LiveMatchActions, SquadPlayer, SerializedMatchFormat } from "@/components/live-match/live-match-client";
import type { LiveEventSummary, LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import { B08_MATCH_FORMAT, b08Squad, B08_LINEUP_STARTER_SLOTS, periodRelativeToGlobalMinute } from "./fixture";
import { b08CanonicalLiveEvents } from "./fixture-history";
import { loadB08Journey, saveB08JourneyEvents, markB08JourneyFinished } from "./b08-journey";
import { markReversedEvents } from "./b08-projection";

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
 * LIVE snapshot instant, mirroring `B08_LIVE_NOW`'s own documented in-progress moment. */
function toGlobalMinute(period: number | null, matchSeconds: number | null): number {
  return periodRelativeToGlobalMinute(period, matchSeconds, B08_MATCH_FORMAT);
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

/** B08 W5 remediation (P1-6) — a fresh interactive journey always starts from the canonical
 * cutoff seed; a journey already in progress (a reload of B08-LIVE itself, mid-session) restores
 * exactly where the coach left off, never the canonical seed again. Reference-snapshot captures
 * (a brand-new browser context, per `scripts/ui-lab-visual-review.mjs`) always see `null` here and
 * fall back to the unchanged canonical seed.
 *
 * W5 THIRD remediation (independent review, 2026-11-08, "final data-integrity remediation",
 * defect #1): gated on `historyOrigin === "LIVE_JOURNEY"`, not merely "a journey exists" — a
 * `"REFERENCE"`-origin persisted report (the coach edited the canonical report directly, with no
 * LIVE session at all) stores `events: []`, which this function previously could not distinguish
 * from a genuinely resumed, empty LIVE session — opening LIVE after such an edit silently lost
 * the real canonical cutoff seed. */
function initialLiveEvents(): LiveEventSummary[] {
  const journey = loadB08Journey();
  return journey?.historyOrigin === "LIVE_JOURNEY" ? journey.events : B08_LIVE_INITIAL_EVENTS;
}

export function useB08LiveFixtureActions(matchId: string) {
  const [events, setEvents] = useState<LiveEventSummary[]>(initialLiveEvents);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const recordEvent = useCallback<LiveMatchActions["recordEvent"]>(async (input) => {
    // W5 THIRD remediation (independent review, 2026-11-08, "final data-integrity remediation",
    // defect #3): mirrors production's own real contract exactly — `clientEventId` is REQUIRED on
    // every real call (`LiveMatchActions["recordEvent"]`'s own type), and production's server
    // dedups a resend by it (confirmed directly against `LiveMatchClient`'s own
    // `reconcileOutboxWithServer()` doc comment: "a resend is dedup-safe server-side by
    // clientEventId"). Before this fix, this fixture adapter had NO such check — it always
    // generated a fresh `id` and appended a new row, so a genuine retry (a reconnect, a reload
    // mid-send, a resent command) silently double-counted a goal/correction/reversal.
    const clientEventId = input.clientEventId;
    const normalizedPeriod = (input.period as MatchPeriod) ?? "SECOND_HALF";
    const normalizedMatchSeconds = input.matchSeconds ?? null;
    const normalizedPlayerId = input.playerId ?? null;
    const normalizedSecondaryPlayerId = input.secondaryPlayerId ?? null;
    let normalizedCorrectsEventId = input.correctsEventId ?? null;

    // W5 THIRD remediation (defect #5, "verify LIVE Undo through a real browser interaction"):
    // `LiveMatchClient.handleUndo(eventId)` reads `eventId` off whatever Recent Events row the
    // coach clicked — a row still on the LOCAL overlay (not yet reconciled into `recentEvents`)
    // carries `id = clientEventId` (see `overlayPendingCommands()`), not the eventual real `id`.
    // `EVENT_REVERSED.correctsEventId` is in the REAL-`id` namespace (`computeEffectiveLiveEvents()`
    // matches it against a target's own `id` only), so an Undo clicked on a local-overlay row would
    // otherwise record a reversal that never actually excludes its target — exactly the kind of
    // reporter/follower disagreement this whole programme exists to close. A real server resolves
    // this by looking up its own canonical row via `clientEventId` before storing; this fixture does
    // the same normalization at its own write boundary, for `EVENT_REVERSED` only (the one event
    // type whose `correctsEventId` is ever in this ambiguous, timing-dependent namespace).
    if (input.eventType === "EVENT_REVERSED" && normalizedCorrectsEventId) {
      const alreadyByRealId = eventsRef.current.some((e) => e.id === normalizedCorrectsEventId);
      if (!alreadyByRealId) {
        const byClientEventId = eventsRef.current.find((e) => e.clientEventId === normalizedCorrectsEventId);
        if (byClientEventId) normalizedCorrectsEventId = byClientEventId.id;
      }
    }

    if (clientEventId) {
      const existing = eventsRef.current.find((e) => e.clientEventId === clientEventId);
      if (existing) {
        const isIdenticalRetry =
          existing.eventType === input.eventType &&
          existing.period === normalizedPeriod &&
          existing.matchSeconds === normalizedMatchSeconds &&
          existing.playerId === normalizedPlayerId &&
          existing.secondaryPlayerId === normalizedSecondaryPlayerId &&
          existing.correctsEventId === normalizedCorrectsEventId;
        if (isIdenticalRetry) {
          // Idempotent no-op: the exact same event was already accepted under this clientEventId
          // — never append a second row, never change the score, never repeat an attribution.
          return { success: true, data: { id: existing.id } };
        }
        // A DIFFERENT event masquerading under an already-accepted clientEventId is a genuine
        // conflict — never silently appended as a second row, never silently overwritten.
        return { success: false, error: "Conflicting duplicate event for this clientEventId." };
      }
    }

    const id = generateFixtureEventId();
    const next: LiveEventSummary[] = [
      ...eventsRef.current,
      {
        id,
        clientEventId: clientEventId ?? null,
        eventType: input.eventType as LiveMatchEventType,
        period: normalizedPeriod,
        matchSeconds: normalizedMatchSeconds,
        wallClockTime: new Date(),
        playerId: normalizedPlayerId,
        secondaryPlayerId: normalizedSecondaryPlayerId,
        isCorrected: false,
        isReversed: false,
        correctsEventId: normalizedCorrectsEventId,
        positionChange: null,
      },
    ];
    setEvents(next);
    // P1-6: persisted immediately (not only held in this component's own React state), so a
    // navigation away from B08-LIVE — not just a re-render — carries the recorded event forward.
    saveB08JourneyEvents(next);
    return { success: true, data: { id } };
  }, []);

  const actions = useMemo<LiveMatchActions>(
    () => ({
      startSession: async () => ({
        success: true,
        data: { id: B08_LIVE_SESSION_ID, startedAt: new Date().toISOString(), format: B08_LIVE_SERIALIZED_FORMAT },
      }),
      endSession: async () => {
        // P1-6: marks this journey "finished" — the Report candidate only reads a FINISHED
        // journey's events, so a half-recorded, abandoned LIVE session (never finished) cannot
        // leak a partial event list into the Report as though it were the final record.
        markB08JourneyFinished(eventsRef.current);
        return { success: true, data: { reportId: "report-gate-b-08", reportStatus: "REPORTED" } };
      },
      heartbeat: async () => {},
      recordEvent,
      // W5 second remediation: marks `isReversed` on an already-undone event (real production
      // computes this server-side; this fixture has no server) so the reporter's own "Undo"
      // button correctly disappears and its "reversed" badge correctly shows — see
      // `markReversedEvents()`'s own doc comment.
      getRecentEvents: async () => ({ success: true, data: markReversedEvents(eventsRef.current) }),
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
