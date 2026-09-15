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
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { ApplyRecommendationFn } from "@/components/touchline/today/today-selection-decisions";
import type { TodayVisitCurrentFacts } from "@/lib/touchline/presentation/today-visit-snapshot";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";

export type TodayFixtureStateKey = "primary" | "planning" | "ready" | "coordination";

export const TODAY_FIXTURE_STATES: { key: TodayFixtureStateKey; label: string }[] = [
  { key: "primary", label: "Primary (golden)" },
  { key: "planning", label: "Planning — no live match" },
  { key: "ready", label: "Ready — no immediate action" },
  { key: "coordination", label: "Coordination — second decision waits" },
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
};

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
        liveNow: undefined,
        selectionDecisions: [decisionOne, decisionTwo],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-planning",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
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
        liveNow: undefined,
        selectionDecisions: [],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-ready",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
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
        liveNow: undefined,
        selectionDecisions: [decisionOne, decisionTwo],
        applyRecommendation: noop,
        sinceLastVisitScope: "uilab-coordination",
        sinceLastVisitFacts: undefined,
        carryForwardItems: [],
      };
  }
}
