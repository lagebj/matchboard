import type { AssistantCommandCentre, TodayMatch } from "@/lib/assistant/types";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import {
  eventMatchToTodayFootballMatch,
  leagueMatchToTodayFootballMatch,
  selectFeaturedTodayFootballMatch,
  type EventMatchTodayFacts,
  type TodayFootballMatchSource,
} from "@/lib/touchline/presentation/today-football-match";
import type { TodayMatchdayReadiness } from "@/lib/touchline/presentation/today-matchday-readiness";

/**
 * Gate C W1 (Today) shared fixture builders — official register C01-C03
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only; see
 * `docs/ui-lab/gate-c-w1-candidates/` for the full review record.
 *
 * P2-01 remediation (independent review of PR #826): every scenario derives from this one fixed
 * reference instant, not the real `Date.now()` — `TodaySurface` now accepts an explicit
 * `nowIso?: string` prop precisely so Gate C fixtures can be fully deterministic (never a date
 * eligibility or Matchday phase that depends on when the capture happens to run). A Tuesday
 * 15:00 Oslo (CET, UTC+1) instant — comfortably midday, far from any local-date boundary, so
 * every same-day offset below stays within the same Europe/Oslo calendar day.
 */
export const GATE_C_NOW_ISO = "2026-11-10T14:00:00.000Z";
export const GATE_C_NOW = new Date(GATE_C_NOW_ISO);

export const GATE_C_ORG_SLUG = "acme";

/** Mirrors `useOrgUrl()`'s real `/o/{slug}${path}` convention exactly — every fixture href below
 * is built through this, or through a real production adapter that already calls it (P2-02
 * remediation: fixture hrefs must follow the same organisation-scoping rules production uses,
 * never a bare unscoped path presented as the production destination). */
export function gateCOrgUrl(path: string): string {
  return `/o/${GATE_C_ORG_SLUG}${path}`;
}

function gateCOffsetIso(minutes: number): string {
  return new Date(GATE_C_NOW.getTime() + minutes * 60_000).toISOString();
}

export function gateCBaseCommandCentre(overrides: Partial<AssistantCommandCentre> = {}): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-2026-autumn",
    leagueSeasonName: "Autumn League 2026",
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: GATE_C_NOW,
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
 * `resolveTodayMatchdayPhase()`'s real 120/45-minute thresholds. */
const PHASE_OFFSET_MINUTES: Record<GateCMatchdayPhase, number> = {
  PREPARE: 180,
  VERIFY: 80,
  IMMINENT: 20,
};

function readinessForPhase(phase: GateCMatchdayPhase): TodayMatchdayReadiness {
  if (phase === "PREPARE") {
    return {
      selection: { state: "DRAFT", selectedCount: 8, targetCount: 11 },
      selectedAvailability: null,
      lineup: { state: "MISSING" },
      tactics: { state: "UNKNOWN" },
      plannedRotations: null,
      blockingSignals: [],
      decisionSignals: [],
    };
  }
  if (phase === "VERIFY") {
    return {
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
    };
  }
  return {
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
}

export type GateCBusyDayResult = {
  matchdayContext: TodayMatchdayContext;
  /** League-only, for `TodayOperationalTimeline` — real production never surfaces Event matches
   * in this timeline either (D12/ADR-0143 §4.7); not a Gate C limitation. */
  todayMatches: TodayMatch[];
  nowIso: string;
};

/**
 * Builds a genuinely busy same-day football context (register C03 — "Matchday or live", "Before
 * kickoff/live"; P1-02 remediation) using the real production contracts:
 * `leagueMatchToTodayFootballMatch()` / `eventMatchToTodayFootballMatch()` adapt each candidate,
 * and `selectFeaturedTodayFootballMatch()` — never this fixture — decides which one is featured.
 *
 * Three same-day matches: one already finished earlier today (needs its report), one later
 * today (lower priority — further from kickoff), and the one intended to be featured for this
 * phase/source. All three are real candidates fed to the real selector; the earlier/later
 * matches exist specifically so a reviewer can verify the selector picks the right one out of a
 * genuinely busy day, not a day with only one match to begin with.
 */
export function gateCBuildBusyDay(params: { source: TodayFootballMatchSource; phase: GateCMatchdayPhase }): GateCBusyDayResult {
  const earlierMatch: TodayMatch = {
    matchId: "match-c03-earlier",
    matchRoundId: "round-c03-earlier",
    matchRoundName: "Round 8",
    teamName: "Vollen",
    opponent: "Åsgård",
    homeAway: "AWAY",
    startsAt: gateCOffsetIso(-240),
    squadStatus: "finalized",
    hasActiveLiveSession: false,
    reportStatus: "none",
    homeScore: 2,
    awayScore: 2,
    lifecycleStatus: "report_incomplete",
  };

  const laterMatch: TodayMatch = {
    matchId: "match-c03-later",
    matchRoundId: "round-c03-later",
    matchRoundName: "Round 10",
    teamName: "Nesøya",
    opponent: "Fagerstrand",
    homeAway: "HOME",
    startsAt: gateCOffsetIso(360),
    squadStatus: "ready",
    hasActiveLiveSession: false,
    reportStatus: "none",
    homeScore: null,
    awayScore: null,
    lifecycleStatus: "planning_open",
  };

  const todayMatches: TodayMatch[] = [earlierMatch, laterMatch];
  const leagueCandidates = todayMatches.map((m) => leagueMatchToTodayFootballMatch(m, gateCOrgUrl));

  let featuredCandidates = leagueCandidates;

  if (params.source === "LEAGUE") {
    const featuredLeagueMatch: TodayMatch = {
      matchId: "match-c03-featured",
      matchRoundId: "round-c03-featured",
      matchRoundName: "Round 9",
      teamName: "Blå",
      opponent: "Stoppen Juventus",
      homeAway: "HOME",
      startsAt: gateCOffsetIso(PHASE_OFFSET_MINUTES[params.phase]),
      squadStatus: params.phase === "PREPARE" ? "draft" : "ready",
      hasActiveLiveSession: false,
      reportStatus: "none",
      homeScore: null,
      awayScore: null,
      lifecycleStatus: "planning_open",
    };
    todayMatches.push(featuredLeagueMatch);
    featuredCandidates = [...leagueCandidates, leagueMatchToTodayFootballMatch(featuredLeagueMatch, gateCOrgUrl)];
  } else {
    const eventFacts: EventMatchTodayFacts = {
      eventMatchId: "event-match-c03-featured",
      eventId: "event-c03-1",
      eventName: "Autumn Cup",
      squadName: "U14 Squad",
      opponentName: "Nordby IL",
      startsAt: gateCOffsetIso(PHASE_OFFSET_MINUTES[params.phase]),
      status: "SCHEDULED",
      hasActiveLiveSession: false,
      hasLineup: false,
      reportStatus: null,
      score: null,
    };
    featuredCandidates = [...leagueCandidates, eventMatchToTodayFootballMatch(eventFacts, gateCOrgUrl, GATE_C_NOW)];
  }

  const featured = selectFeaturedTodayFootballMatch(featuredCandidates);
  if (!featured) {
    throw new Error("gate-c fixture: gateCBuildBusyDay() produced no featured match — fixture construction bug");
  }

  return {
    matchdayContext: { featured, readiness: readinessForPhase(params.phase) },
    todayMatches,
    nowIso: GATE_C_NOW_ISO,
  };
}
