import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import type { TodayFootballMatchSource } from "@/lib/touchline/presentation/today-football-match";
import type { TodayMatchdayReadiness } from "@/lib/touchline/presentation/today-matchday-readiness";

/**
 * Gate C W1 (Today) shared fixture builders — official register C01-C03
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only; see
 * `docs/ui-lab/gate-c-w1-candidates/` for the full review record, including why no official
 * Gate C wave-ordering document exists and this wave's scope is self-assigned.
 *
 * `TodaySurface` computes `nowIso` internally as `new Date().toISOString()` (`today-surface.tsx`)
 * rather than accepting it as a prop — it is the real production composition owner and this
 * candidate wave does not change that. Matchday fixtures therefore express kickoff as an offset
 * from the real current time, computed fresh on every request, rather than a fixed past/future
 * timestamp — the only way to genuinely and permanently cross `resolveTodayMatchdayPhase()`'s
 * real 120/45-minute thresholds (never a hand-labeled phase string) without the fixture drifting
 * into a different phase as real time passes.
 */

export const GATE_C_FIXTURE_COMPUTED_AT = new Date("2026-11-09T09:00:00.000Z");

export function gateCBaseCommandCentre(overrides: Partial<AssistantCommandCentre> = {}): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-2026-autumn",
    leagueSeasonName: "Autumn League 2026",
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: GATE_C_FIXTURE_COMPUTED_AT,
    ...overrides,
  };
}

/** The real loader's always-defined "nothing live" shape (`getTodayLiveMatchSummaries()`) —
 * never `undefined`. A prior production incident (today-surface.matchday-livenow-gate.test.tsx)
 * came from a fixture that hand-authored `liveNow: undefined` instead of this real shape. */
export function gateCNoLiveMatch(): TodayLiveNowResult {
  return { primary: null, otherLiveCount: 0 };
}

export type GateCMatchdayPhase = "PREPARE" | "VERIFY" | "IMMINENT";

/** Minutes-to-kickoff offsets chosen with comfortable margin either side of
 * `resolveTodayMatchdayPhase()`'s real 120/45-minute thresholds, so render-time jitter can never
 * tip a fixture into the wrong phase. */
const PHASE_OFFSET_MINUTES: Record<GateCMatchdayPhase, number> = {
  PREPARE: 180,
  VERIFY: 80,
  IMMINENT: 20,
};

function offsetIso(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/**
 * Builds a real, phase-genuine `TodayMatchdayContext` for one League or Event match (register
 * C03 — "Matchday or live", "Before kickoff/live"). `readiness` varies by phase to demonstrate a
 * real, distinct primary action per phase (`resolveTodayMatchdayAction()`'s own fixed priority
 * order) rather than three screenshots of the same fact with a different label:
 *
 * - PREPARE: squad still being drafted, no lineup yet -> `MISSING_LINEUP`.
 * - VERIFY: squad and lineup ready, one selected player doubtful -> `DOUBTFUL_PLAYER`.
 * - IMMINENT: everything ready, nothing outstanding -> `START_LIVE`.
 *
 * Tactics readiness is `"UNKNOWN"` in every phase for both sources — Event has no tactics data
 * source at all, and this fixture does not invent one for League either (D7 "never invented";
 * brief §6 "no unsupported football metrics").
 */
export function gateCBuildMatchdayContext(params: {
  source: TodayFootballMatchSource;
  phase: GateCMatchdayPhase;
  now?: Date;
}): TodayMatchdayContext {
  const now = params.now ?? new Date();
  const startsAt = offsetIso(now, PHASE_OFFSET_MINUTES[params.phase]);
  const isEvent = params.source === "EVENT";

  const id = isEvent ? "event-match-c03-1" : "match-c03-1";
  const containerId = isEvent ? "event-c03-1" : "round-c03-1";
  const containerLabel = isEvent ? "Autumn Cup" : "Round 9";
  const href = isEvent ? `/events/${containerId}` : `/matches/${id}`;
  const liveEntryHref = isEvent ? `/events/${containerId}/matches/${id}/live` : `/matches/${id}/live`;

  const readiness: TodayMatchdayReadiness =
    params.phase === "PREPARE"
      ? {
          selection: { state: "DRAFT", selectedCount: 8, targetCount: 11 },
          selectedAvailability: null,
          lineup: { state: "MISSING" },
          tactics: { state: "UNKNOWN" },
          plannedRotations: null,
          blockingSignals: [],
          decisionSignals: [],
        }
      : params.phase === "VERIFY"
        ? {
            selection: { state: "READY", selectedCount: 11, targetCount: 11 },
            selectedAvailability: {
              selectedCount: 11,
              availableCount: 10,
              doubtfulCount: 1,
              unavailableCount: 0,
              unknownCount: 0,
              affectedPlayers: [{ playerId: "player-jonas", displayName: "Jonas", state: "DOUBTFUL" }],
            },
            lineup: { state: "READY" },
            tactics: { state: "UNKNOWN" },
            plannedRotations: { count: 2 },
            blockingSignals: [],
            decisionSignals: [],
          }
        : {
            selection: { state: "READY", selectedCount: 11, targetCount: 11 },
            selectedAvailability: {
              selectedCount: 11,
              availableCount: 11,
              doubtfulCount: 0,
              unavailableCount: 0,
              unknownCount: 0,
              affectedPlayers: [],
            },
            lineup: { state: "READY" },
            tactics: { state: "UNKNOWN" },
            plannedRotations: { count: 2 },
            blockingSignals: [],
            decisionSignals: [],
          };

  return {
    featured: {
      id,
      source: params.source,
      containerId,
      containerLabel,
      teamOrSquadName: isEvent ? "U14 Squad" : "Blå",
      opponentName: isEvent ? "Nordby IL" : "Stoppen Juventus",
      startsAt,
      venueLabel: isEvent ? null : "Home",
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      reportState: null,
      score: null,
      href,
      liveEntryHref,
    },
    readiness,
  };
}
