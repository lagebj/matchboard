/**
 * Today Operational Command Surface UI Lab fixtures (ADR-0141,
 * `.matchboard-work/matchboard_today_operational_surface_2026-09-14/05_IMPLEMENTATION_PLAN.md`
 * §"UI Lab"). Representative, in-memory only — no database, no production writes, no real
 * server-action calls (`applyRecommendation` below simulates the mutation contract's shape).
 * Shapes are typed against the real production contracts so this fixture set doubles as an
 * end-to-end shape check, same convention as `../../fixtures.ts`.
 */
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import type { AssistantCommandCentre, AssistantWorkItem, TodayMatch } from "@/lib/assistant/types";
import type { CoachDecision, CoachSituationProjection } from "@/lib/situational/situation-types";
import type { RoundPlanIntegrity, PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { ApplyRecommendationFn } from "@/components/touchline/today/today-selection-decisions";
import type { TodayVisitCurrentFacts } from "@/lib/touchline/presentation/today-visit-snapshot";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import type { TodayFootballMatch } from "@/lib/touchline/presentation/today-football-match";
import type { TodayMatchdayReadiness } from "@/lib/touchline/presentation/today-matchday-readiness";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";

export type TodayFixtureStateKey =
  | "primary"
  | "planning"
  | "ready"
  | "coordination"
  | "matchday-prepare"
  | "matchday-verify-problem"
  | "matchday-imminent-ready"
  | "matchday-live"
  | "matchday-post"
  | "matchday-multiple"
  | "matchday-event";

export const TODAY_FIXTURE_STATES: { key: TodayFixtureStateKey; label: string }[] = [
  { key: "primary", label: "Primary (golden)" },
  { key: "planning", label: "Planning — no live match" },
  { key: "ready", label: "Ready — no immediate action" },
  { key: "coordination", label: "Coordination — second decision waits" },
  { key: "matchday-prepare", label: "Matchday — prepare" },
  { key: "matchday-verify-problem", label: "Matchday — verify (doubtful player)" },
  { key: "matchday-imminent-ready", label: "Matchday — imminent, ready" },
  { key: "matchday-live", label: "Matchday — live (Live Now owns anchor)" },
  { key: "matchday-post", label: "Matchday — post-match" },
  { key: "matchday-multiple", label: "Matchday — multiple same-day matches" },
  { key: "matchday-event", label: "Matchday — Event match" },
];

function makeItem(overrides: Partial<AssistantWorkItem> & Pick<AssistantWorkItem, "category" | "id">): AssistantWorkItem {
  return {
    priority: 0,
    title: "Title",
    summary: "Summary",
    matchRoundId: "round-1",
    affectedTeamIds: [],
    affectedPlayerIds: [],
    primaryActionLabel: "Do it",
    primaryActionHref: "/fixtures",
    ...overrides,
  };
}

function makeCommandCentre(
  items: AssistantWorkItem[],
  todayMatches: TodayMatch[],
  roundPlanIntegrities: Record<string, RoundPlanIntegrity> = {},
  activeLiveSessions: AssistantCommandCentre["activeLiveSessions"] = {},
): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-1",
    leagueSeasonName: "Autumn 2026",
    items,
    todayMatches,
    dueDecisionReviews: [],
    roundPlanIntegrities,
    activeLiveSessions,
    computedAt: new Date(),
  };
}

function makeTodayMatch(overrides: Partial<TodayMatch> & Pick<TodayMatch, "matchId">): TodayMatch {
  return {
    matchRoundId: "round-1",
    matchRoundName: "Round 34",
    teamName: "Rød",
    opponent: "Graabein United",
    homeAway: "HOME",
    startsAt: null,
    squadStatus: "finalized",
    hasActiveLiveSession: false,
    reportStatus: null,
    homeScore: null,
    awayScore: null,
    lifecycleStatus: "planning_closed",
    ...overrides,
  };
}

function makeProjection(
  overrides: Partial<CoachSituationProjection["situation"]>,
  status: CoachSituationProjection["status"] = "ACTION_REQUIRED",
  decisions: CoachDecision[] = [],
): CoachSituationProjection {
  return {
    situation: {
      nowIso: new Date().toISOString(),
      primarySituation: "NEXT",
      imminentMatchIds: [],
      temporal: {},
      ...overrides,
    },
    decisions,
    deferredCount: 0,
    status,
    policyRuntimeStatus: "HEALTHY",
  };
}

/* --- Primary fixture's top decision: a raw, generically-rendered CoachDecision (the "no
 * natural raw-signal mapping" GENERIC path in resolveTodayPrimaryAction()) representing the
 * outstanding post-match report for the completed Sætre Lions vs Rød match (mirrors "report-1"
 * below — same match, same real fixture fact, not an invented one). Its candidateId
 * deliberately uses a provider prefix ("assistant-work-items") distinct from the plan-integrity
 * and live-session candidate providers, so it resolves via GENERIC rather than accidentally
 * matching either of those. */
const reportDecision: CoachDecision = {
  id: "decision-report-1",
  candidateId: "assistant-work-items|report-1",
  situation: "MATCHDAY",
  horizon: "NOW",
  visibility: "PROMOTE",
  urgency: "SOON",
  interaction: "REVIEW",
  title: "Complete the Sætre Lions vs Rød post-match report",
  summary: "Rød won 4–2 against Sætre Lions. Evidence is not locked until the report is submitted.",
  recommendedAction: { label: "Complete report", href: "/matches/h1" },
  alternatives: [],
  affectedEntities: [{ entityType: "MATCH", entityId: "h1" }],
  reasonCodes: ["POST_MATCH_REPORT_MISSING"],
};

const noop: ApplyRecommendationFn = async () => ({ success: true, message: "Applied (UI Lab fixture — no real mutation)." });

/* --- Recent football (earlier match requiring report follow-up + a completed win) ---------- */
const recentMatches: MatchPresentation[] = [
  buildMatchPresentation({ id: "h1", href: null, teamName: "Rød", opponentName: "Sætre Lions", isHome: false, kickoffAt: null, lifecycleStatus: "done", ownGoals: 4, opponentGoals: 2, outcome: "WON" }),
  buildMatchPresentation({ id: "h2", href: null, teamName: "Rød", opponentName: "Hurum City", isHome: true, kickoffAt: null, lifecycleStatus: "done", ownGoals: 3, opponentGoals: 3, outcome: "DRAWN" }),
];

/* --- Squad status ------------------------------------------------------------------------- */
const squadStatus: TodaySquadStatus = {
  available: 16,
  doubtful: 2,
  unavailable: 3,
  notAvailable: [
    { playerId: "p-oliver", displayName: "Oliver Hansen", reason: "Injured" },
    { playerId: "p-sander", displayName: "Sander Nilsen", reason: "Sick" },
    { playerId: "p-marius", displayName: "Marius Dahl", reason: "Away" },
  ],
};

/* --- Live Now: active live match, score 3-2, running clock -------------------------------- */
const liveNowPrimary: TodayLiveNowResult = {
  primary: {
    matchId: "match-live-1",
    sessionId: "session-live-1",
    teamName: "Rød",
    opponentName: "Graabein United",
    goalsFor: 3,
    goalsAgainst: 2,
    periodLabel: "Second half",
    elapsedLabel: "67:42",
    isRunning: true,
  },
  otherLiveCount: 1,
};

/* --- Live Now: no active live match — `getTodayLiveMatchSummaries()` always resolves to this
 * defined `{ primary: null, otherLiveCount: 0 }` shape, never `null`/`undefined` (confirmed after
 * a production incident where fixtures using `liveNow: undefined` masked a bug that only the real
 * always-defined shape exposed — see `today-surface.tsx`'s `liveNow?.primary` gate). ------------ */
const noLiveMatch: TodayLiveNowResult = { primary: null, otherLiveCount: 0 };

/* --- Selection decisions: two missing-opportunity signals, second coordinated on the first - */
const decisionOne: TodaySelectionDecision = {
  signalKey: "signal-elias-w35",
  playerId: "player-elias",
  displayName: "Elias Berg",
  availability: "AVAILABLE",
  roundId: "round-35",
  roundLabel: "Round 35",
  problemTitle: "Available player without planned opportunity",
  problemDetail: "Elias has no planned match this round despite being available.",
  reasons: [
    { text: "Available for the whole round" },
    { text: "No selection in any match this round" },
    { text: "2 rounds since Elias last played" },
  ],
  recommendation: {
    targetMatchId: "match-hvit-tofte",
    targetTeamName: "Hvit",
    opponentName: "Tofte",
    role: "CORE",
    fingerprint: "fp-elias-hvit-core-v1",
    directlyActionable: true,
    dependsOnPrior: false,
    prerequisiteSignalKeys: [],
    unavailableReason: null,
  },
  roundBoardHref: "/dev/ui-lab/atlas/routes/round-board",
  decisionFingerprint: "fixture-fingerprint-elias-w35-v1",
};

const decisionTwo: TodaySelectionDecision = {
  signalKey: "signal-noah-w35",
  playerId: "player-noah",
  displayName: "Noah Kristiansen",
  availability: "AVAILABLE",
  roundId: "round-35",
  roundLabel: "Round 35",
  problemTitle: "Available player without planned opportunity",
  problemDetail: "Noah has no planned match this round despite being available.",
  reasons: [
    { text: "Available for the whole round" },
    { text: "No selection in any match this round" },
  ],
  recommendation: {
    targetMatchId: "match-hvit-tofte",
    targetTeamName: "Hvit",
    opponentName: "Tofte",
    role: "CORE",
    fingerprint: "fp-noah-hvit-core-v1",
    directlyActionable: false,
    dependsOnPrior: true,
    prerequisiteSignalKeys: [decisionOne.signalKey],
    unavailableReason: null,
  },
  roundBoardHref: "/dev/ui-lab/atlas/routes/round-board",
  decisionFingerprint: "fixture-fingerprint-noah-w35-v1",
};

/* --- Since your last visit ----------------------------------------------------------------- */
const sinceLastVisitFacts: TodayVisitCurrentFacts = {
  liveMatchIds: ["match-live-1"],
  matches: [
    { matchId: "match-live-1", kickoffIso: new Date(Date.now() - 68 * 60_000).toISOString(), reportState: "NONE", label: "Rød vs Graabein United" },
    { matchId: "match-hvit-tofte", kickoffIso: new Date(Date.now() + 3 * 3_600_000).toISOString(), reportState: "NONE", label: "Hvit vs Tofte" },
    { matchId: "h2", kickoffIso: new Date(Date.now() - 26 * 3_600_000).toISOString(), reportState: "REPORTED", label: "Rød vs Hurum City" },
  ],
  planSignals: [
    { signalKey: decisionOne.signalKey, title: decisionOne.problemTitle },
    { signalKey: decisionTwo.signalKey, title: decisionTwo.problemTitle },
  ],
  rounds: [
    { roundId: "round-35", label: "Round 35", blocked: 0, decisions: 2 },
    { roundId: "round-34", label: "Round 34", blocked: 0, decisions: 0 },
  ],
};

/* --- Carry forward (weekly context compact adapter output) -------------------------------- */
const carryForwardItems: TodayCarryForwardItem[] = [
  { id: "report:h1", label: "Report still needed — Sætre Lions vs Rød", href: "/matches/h1" },
];

export type TodayFixture = {
  commandCentre: AssistantCommandCentre;
  projection: CoachSituationProjection;
  recentMatches: MatchPresentation[];
  squadStatus: TodaySquadStatus | null;
  liveNow: TodayLiveNowResult | undefined;
  selectionDecisions: TodaySelectionDecision[];
  applyRecommendation: ApplyRecommendationFn;
  sinceLastVisitScope: string;
  sinceLastVisitFacts: TodayVisitCurrentFacts | undefined;
  carryForwardItems: TodayCarryForwardItem[];
  matchdayContext: TodayMatchdayContext | undefined;
};

/* --- Matchday (ADR-0143) fixture helpers ---------------------------------------------------- */
function makeFootballMatch(overrides: Partial<TodayFootballMatch> & Pick<TodayFootballMatch, "id">): TodayFootballMatch {
  return {
    source: "LEAGUE",
    containerId: "round-42",
    containerLabel: "Round 42",
    teamOrSquadName: "Rød",
    opponentName: "Konnerud Blå",
    startsAt: null,
    venueLabel: "Home",
    lifecycleStatus: "planning_open",
    hasActiveLiveSession: false,
    reportState: null,
    score: null,
    href: `/matches/${overrides.id}`,
    liveEntryHref: `/matches/${overrides.id}/live`,
    ...overrides,
  };
}

function makeReadiness(input: {
  availableCount: number;
  doubtfulCount: number;
  unavailableCount: number;
  affectedPlayers?: NonNullable<TodayMatchdayReadiness["selectedAvailability"]>["affectedPlayers"];
  blockingSignals?: PlanIntegritySignal[];
}): TodayMatchdayReadiness {
  const selectedCount = input.availableCount + input.doubtfulCount + input.unavailableCount;
  return {
    selection: { state: "FINALIZED", selectedCount, targetCount: selectedCount },
    selectedAvailability: {
      selectedCount,
      availableCount: input.availableCount,
      doubtfulCount: input.doubtfulCount,
      unavailableCount: input.unavailableCount,
      unknownCount: 0,
      affectedPlayers: input.affectedPlayers ?? [],
    },
    lineup: { state: "READY" },
    tactics: { state: "UNKNOWN" },
    plannedRotations: null,
    blockingSignals: input.blockingSignals ?? [],
    decisionSignals: [],
  };
}

export function buildTodayFixture(state: TodayFixtureStateKey): TodayFixture {
  switch (state) {
    case "primary":
      return {
        commandCentre: makeCommandCentre(
          [
            makeItem({ id: "report-1", category: "post_match_report", matchId: "h1", matchRoundId: "round-34", title: "Report needed: Sætre Lions vs Rød", summary: "Finalize the report for the completed match.", primaryActionLabel: "Report match", primaryActionHref: "/matches/h1" }),
          ],
          [
            makeTodayMatch({ matchId: "match-live-1", matchRoundId: "round-34", teamName: "Rød", opponent: "Graabein United", homeAway: "HOME", startsAt: new Date(Date.now() - 68 * 60_000).toISOString(), hasActiveLiveSession: true, lifecycleStatus: "live", homeScore: 3, awayScore: 2 }),
            makeTodayMatch({ matchId: "match-hvit-tofte", matchRoundId: "round-35", teamName: "Hvit", opponent: "Tofte", homeAway: "AWAY", startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), lifecycleStatus: "planning_open" }),
          ],
        ),
        projection: makeProjection({ primarySituation: "MATCHDAY", activeMatchId: "match-live-1" }, "LIVE", [reportDecision]),
        recentMatches,
        squadStatus,
        liveNow: liveNowPrimary,
        selectionDecisions: [decisionOne, decisionTwo],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-primary",
        sinceLastVisitFacts,
        carryForwardItems,
        matchdayContext: undefined,
      };
    case "planning":
      return {
        commandCentre: makeCommandCentre(
          [
            makeItem({ id: "setup-1", category: "event_setup_missing", matchId: "match-hvit-tofte", matchRoundId: "round-35", title: "Set up Hvit vs Tofte", summary: "Confirm kickoff details and squad for the next match.", primaryActionLabel: "Set up match", primaryActionHref: "/matches/match-hvit-tofte" }),
          ],
          [
            makeTodayMatch({ matchId: "match-hvit-tofte", matchRoundId: "round-35", teamName: "Hvit", opponent: "Tofte", homeAway: "AWAY", startsAt: new Date(Date.now() + 26 * 3_600_000).toISOString(), lifecycleStatus: "planning_open" }),
          ],
        ),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [decisionOne, decisionTwo],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-planning",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: undefined,
      };
    case "ready":
      return {
        commandCentre: makeCommandCentre(
          [],
          [
            makeTodayMatch({ matchId: "match-hvit-tofte", matchRoundId: "round-35", teamName: "Hvit", opponent: "Tofte", homeAway: "AWAY", startsAt: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(), lifecycleStatus: "planning_closed", squadStatus: "finalized" }),
          ],
        ),
        projection: makeProjection({ primarySituation: "NEXT" }, "READY"),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-ready",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: undefined,
      };
    case "coordination":
      return {
        commandCentre: makeCommandCentre(
          [],
          [
            makeTodayMatch({ matchId: "match-hvit-tofte", matchRoundId: "round-35", teamName: "Hvit", opponent: "Tofte", homeAway: "AWAY", startsAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), lifecycleStatus: "planning_open" }),
          ],
        ),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [decisionOne, decisionTwo],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-coordination",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: undefined,
      };
    case "matchday-prepare":
      return {
        commandCentre: makeCommandCentre([], []),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-prepare",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "match-w42",
            startsAt: new Date(Date.now() + 3 * 3_600_000 + 25 * 60_000).toISOString(),
            containerLabel: "Round 42",
          }),
          readiness: makeReadiness({ availableCount: 10, doubtfulCount: 0, unavailableCount: 0 }),
        },
      };
    case "matchday-verify-problem":
      return {
        commandCentre: makeCommandCentre([], []),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-verify",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "match-w42",
            startsAt: new Date(Date.now() + 95 * 60_000).toISOString(),
            containerLabel: "Round 42",
          }),
          readiness: makeReadiness({
            availableCount: 9,
            doubtfulCount: 1,
            unavailableCount: 0,
            affectedPlayers: [{ playerId: "player-noah", displayName: "Noah", state: "DOUBTFUL" }],
          }),
        },
      };
    case "matchday-imminent-ready":
      return {
        commandCentre: makeCommandCentre([], []),
        projection: makeProjection({ primarySituation: "MATCHDAY" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-imminent",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "match-w42",
            startsAt: new Date(Date.now() + 28 * 60_000).toISOString(),
            containerLabel: "Round 42",
          }),
          readiness: makeReadiness({ availableCount: 10, doubtfulCount: 0, unavailableCount: 0 }),
        },
      };
    case "matchday-live":
      // A live session already exists for today's match — Live Now owns the anchor and Matchday
      // is not computed at all for this fixture (ADR-0143 §4.5), mirroring production wiring
      // exactly (`matchdayContext` is `undefined` whenever `liveNow` is present).
      return {
        commandCentre: makeCommandCentre(
          [],
          [
            makeTodayMatch({
              matchId: "match-live-1",
              matchRoundId: "round-42",
              matchRoundName: "Round 42",
              teamName: "Rød",
              opponent: "Konnerud Blå",
              homeAway: "HOME",
              startsAt: new Date(Date.now() - 40 * 60_000).toISOString(),
              hasActiveLiveSession: true,
              lifecycleStatus: "live",
              homeScore: 1,
              awayScore: 0,
            }),
          ],
        ),
        projection: makeProjection({ primarySituation: "MATCHDAY", activeMatchId: "match-live-1" }, "LIVE"),
        recentMatches,
        squadStatus,
        liveNow: {
          primary: {
            matchId: "match-live-1",
            sessionId: "session-live-1",
            teamName: "Rød",
            opponentName: "Konnerud Blå",
            goalsFor: 1,
            goalsAgainst: 0,
            periodLabel: "First half",
            elapsedLabel: "38:12",
            isRunning: true,
          },
          otherLiveCount: 0,
        },
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-live",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: undefined,
      };
    case "matchday-post":
      return {
        commandCentre: makeCommandCentre([], []),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-post",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "match-w42",
            startsAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
            containerLabel: "Round 42",
            lifecycleStatus: "report_incomplete",
            score: { own: 5, opponent: 3 },
            reportState: "reported",
          }),
          readiness: makeReadiness({ availableCount: 10, doubtfulCount: 0, unavailableCount: 0 }),
        },
      };
    case "matchday-multiple":
      return {
        commandCentre: makeCommandCentre(
          [],
          [
            makeTodayMatch({
              matchId: "match-w42-b",
              matchRoundId: "round-35",
              matchRoundName: "Round 35",
              teamName: "Hvit",
              opponent: "Tofte",
              homeAway: "AWAY",
              startsAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
              lifecycleStatus: "planning_open",
            }),
          ],
        ),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-multiple",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "match-w42-a",
            startsAt: new Date(Date.now() + 90 * 60_000).toISOString(),
            containerLabel: "Round 42",
          }),
          readiness: makeReadiness({ availableCount: 10, doubtfulCount: 0, unavailableCount: 0 }),
        },
      };
    case "matchday-event":
      return {
        commandCentre: makeCommandCentre([], []),
        projection: makeProjection({ primarySituation: "NEXT" }),
        recentMatches,
        squadStatus,
        liveNow: noLiveMatch,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-matchday-event",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
        matchdayContext: {
          featured: makeFootballMatch({
            id: "event-match-1",
            source: "EVENT",
            teamOrSquadName: "Hvit",
            opponentName: "Summer Cup Rivals",
            containerLabel: "Summer Cup",
            venueLabel: null,
            startsAt: new Date(Date.now() + 42 * 60_000).toISOString(),
            href: "/events/summer-cup",
            liveEntryHref: "/events/summer-cup/matches/event-match-1/live",
          }),
          readiness: makeReadiness({ availableCount: 8, doubtfulCount: 0, unavailableCount: 0 }),
        },
      };
  }
}
