import {
  summarizeMatchAttendance,
  aggregateGoalScorers,
  aggregateAssistProviders,
  buildMatchTimeline,
  buildPlayerInvolvement,
  type MatchAttendanceFact,
  type MatchGoalFact,
  type MatchAssistFact,
  type MatchCanonicalLiveEventFact,
} from "@/lib/matches/match-detail-view-model";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { MatchReportDetail } from "@/app/(app)/matches/[matchId]/post-match/actions";
import type { GoalAttributionGap } from "@/lib/reports/report-mutations";
import type { PostMatchReportTimingReviewRow } from "@/lib/reports/post-match-report-view-model";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { MATCH_B_TEAM_NAME, B05_MATCH_ID, B05_REPORT_ID, B05_OPPONENT_NAME } from "../../shared/match-b-fixture";

/**
 * B06 remediation (B2-R2/B2-R4/B2-R7) — fixtureVersion 2. Supersedes fixtureVersion 1's hand-
 * written `{liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true}` gap object, which did not
 * follow production `computeGoalAttributionGap()` (`report-mutations.ts`): `attributedGoals` is
 * a plain `db.goal.count()` — a row count, never filtered by scorer — so a 3-row report (even
 * with one row's `playerId: null`) always yields `attributedGoals: 3`, not 2. See
 * `docs/ui-lab/gate-b-w2-candidates/BLOCKERS.md` for the full history.
 *
 * The honest, production-faithful version of this scenario: 3 canonical live `GOAL_FOR` events
 * genuinely exist (this match WAS live-reported) and the coach's own Goal rows on the report
 * lag behind that live truth by exactly one row in the draft — not a wrong attribution, a
 * missing row entirely. `b05CanonicalLiveEvents` is the one true historical record, identical
 * in both lifecycle states (live events are immutable once recorded); only `b05Goals()` — the
 * report's own rows — differs by variant.
 */
export const B05_COMPLETED_AT = new Date("2026-10-11T12:05:00.000Z").toISOString();
export const B05_COMPLETED_BY = "Marte Johansen";

export const b05AttendanceFacts: MatchAttendanceFact[] = [
  { attendanceStatus: "PRESENT", playerName: "Aksel" },
  { attendanceStatus: "PRESENT", playerName: "Tobias" },
  { attendanceStatus: "PRESENT", playerName: "Sindre" },
  { attendanceStatus: "PRESENT", playerName: "Noah" },
  { attendanceStatus: "PRESENT", playerName: "Vetle" },
  { attendanceStatus: "PRESENT", playerName: "Kasper" },
  { attendanceStatus: "PRESENT", playerName: "Elias" },
  { attendanceStatus: "NO_SHOW", playerName: "Magnus" },
];

export const b05AttendanceSummary = summarizeMatchAttendance(b05AttendanceFacts);

/**
 * The one true live record for this match — 3 `GOAL_FOR`, 2 `GOAL_AGAINST` (matching the real
 * 3-2 final score), with `SCORER_SET`/`ASSIST_SET` correction events pairing scorer/assist names
 * to their goal via `correctsEventId` -> the goal's own `clientEventId`, exactly the real
 * production linkage (`buildMatchTimelineFromLiveEvents()`, not by array index or proximity).
 * Fixed for both draft and completed — a live event stream does not change when a coach edits
 * their own report afterwards.
 */
export const b05CanonicalLiveEvents: MatchCanonicalLiveEventFact[] = [
  { id: "live-gb5-goal-1", eventType: "GOAL_FOR", playerName: null, clientEventId: "client-gb5-goal-1", correctsEventId: null, minuteLabel: "12'", period: 1, matchSeconds: 720 },
  { id: "live-gb5-scorer-1", eventType: "SCORER_SET", playerName: "Noah", clientEventId: null, correctsEventId: "client-gb5-goal-1", minuteLabel: null, period: 1, matchSeconds: 720 },
  { id: "live-gb5-goal-against-1", eventType: "GOAL_AGAINST", playerName: null, clientEventId: "client-gb5-goal-against-1", correctsEventId: null, minuteLabel: "20'", period: 1, matchSeconds: 1200 },
  { id: "live-gb5-goal-2", eventType: "GOAL_FOR", playerName: null, clientEventId: "client-gb5-goal-2", correctsEventId: null, minuteLabel: "34'", period: 1, matchSeconds: 2040 },
  { id: "live-gb5-scorer-2", eventType: "SCORER_SET", playerName: "Sindre", clientEventId: null, correctsEventId: "client-gb5-goal-2", minuteLabel: null, period: 1, matchSeconds: 2040 },
  { id: "live-gb5-assist-2", eventType: "ASSIST_SET", playerName: "Vetle", clientEventId: null, correctsEventId: "client-gb5-goal-2", minuteLabel: null, period: 1, matchSeconds: 2040 },
  { id: "live-gb5-goal-against-2", eventType: "GOAL_AGAINST", playerName: null, clientEventId: "client-gb5-goal-against-2", correctsEventId: null, minuteLabel: "50'", period: 2, matchSeconds: 600 },
  { id: "live-gb5-goal-3", eventType: "GOAL_FOR", playerName: null, clientEventId: "client-gb5-goal-3", correctsEventId: null, minuteLabel: "61'", period: 2, matchSeconds: 1260 },
  { id: "live-gb5-scorer-3", eventType: "SCORER_SET", playerName: "Kasper", clientEventId: null, correctsEventId: "client-gb5-goal-3", minuteLabel: null, period: 2, matchSeconds: 1260 },
];

export const B05_LIVE_GOALS_RECORDED = b05CanonicalLiveEvents.filter((e) => e.eventType === "GOAL_FOR").length;

/**
 * The report's OWN Goal rows — genuinely fewer in draft (2, not 3-with-a-null-scorer): the 34'
 * goal has no report row at all yet, matching production's real `db.goal.count()` semantics
 * (row count, not scorer-presence count). The final score (`b05InitialReport`'s
 * `homeGoals`/`awayGoals`) stays 3-2 in both states, independent of how many Goal rows exist —
 * the official result is never derived from counting report rows.
 */
export function b05Goals(variant: "draft" | "completed"): MatchGoalFact[] {
  const base: MatchGoalFact[] = [
    { id: "goal-gb5-1", participantKey: "player-gb5-noah", playerName: "Noah", minute: 12, type: "NORMAL" },
    { id: "goal-gb5-3", participantKey: "player-gb5-kasper", playerName: "Kasper", minute: 61, type: "NORMAL" },
  ];
  if (variant === "draft") return base;
  return [...base, { id: "goal-gb5-2", participantKey: "player-gb5-sindre", playerName: "Sindre", minute: 34, type: "NORMAL" }];
}

/** The 34' goal's assist — does not exist as a report row until the goal itself does. */
export function b05Assists(variant: "draft" | "completed"): MatchAssistFact[] {
  if (variant === "draft") return [];
  return [{ id: "assist-gb5-1", participantKey: "player-gb5-vetle", playerName: "Vetle", type: "NORMAL" }];
}

export function b05GoalScorers(variant: "draft" | "completed") {
  return aggregateGoalScorers(b05Goals(variant));
}

export function b05AssistProviders(variant: "draft" | "completed") {
  return aggregateAssistProviders(b05Assists(variant));
}

/** Sourced from the real canonical live events (never empty here, since this match genuinely
 * was live-reported) — identical in both lifecycle states, via the same real
 * `buildMatchTimeline()` "live events are primary whenever any exist" rule. Deliberately NOT
 * parameterized by variant: the match-day timeline is a historical fact independent of how far
 * along the coach's own report is. */
export const b05Timeline = buildMatchTimeline({ canonicalLiveEvents: b05CanonicalLiveEvents, reportGoals: [] });

/** Follows the real `computeGoalAttributionGap()` contract exactly: `liveGoalsRecorded` is the
 * count of real canonical `GOAL_FOR` events (never confused with report-row count or
 * known-scorer count); `attributedGoals` is a plain count of report Goal rows (never filtered
 * by scorer presence); `hasGap` is `attributedGoals < liveGoalsRecorded`. */
export function b05GoalAttributionGap(variant: "draft" | "completed"): GoalAttributionGap {
  const attributedGoals = b05Goals(variant).length;
  return { liveGoalsRecorded: B05_LIVE_GOALS_RECORDED, attributedGoals, hasGap: attributedGoals < B05_LIVE_GOALS_RECORDED };
}

export function b05TimingReview(variant: "draft" | "completed"): PostMatchReportTimingReviewRow[] {
  return [
    {
      period: "SECOND_HALF",
      periodLabel: "Second half",
      resolvedDurationMinutes: variant === "draft" ? 42 : 45,
      needsReview: variant === "draft",
    },
  ];
}

export const b05MinutesByParticipant = new Map<string, number>([
  ["player-gb5-aksel", 90],
  ["player-gb5-tobias", 90],
  ["player-gb5-sindre", 90],
  ["player-gb5-noah", 83],
  ["player-gb5-vetle", 90],
  ["player-gb5-kasper", 68],
  ["player-gb5-elias", 22],
]);

export const b05ObservationCountByParticipant = new Map<string, number>([["player-gb5-elias", 1]]);

export const b05PresentParticipants = b05AttendanceFacts
  .filter((a) => a.attendanceStatus === "PRESENT")
  .map((a) => ({ participantKey: `player-gb5-${a.playerName.toLowerCase()}`, playerName: a.playerName }));

export function b05PlayerInvolvement(variant: "draft" | "completed") {
  return buildPlayerInvolvement({
    presentParticipants: b05PresentParticipants,
    goals: b05Goals(variant),
    assists: b05Assists(variant),
    observationCountByParticipant: b05ObservationCountByParticipant,
    minutesByParticipant: b05MinutesByParticipant,
  });
}

export const b05Reflection = {
  effort: "STRONG",
  teamCohesion: "OK",
  positionalShape: "NEEDS_ATTENTION",
  recoveryBehavior: "STRONG",
  note: "Slow start but a good response after going behind twice.",
};

export const b05FootballObservations = [
  {
    id: "obs-gb5-1",
    playerId: "player-gb5-elias",
    playerName: "Elias",
    observationCode: "WORK_RATE_EFFECTIVE",
    polarity: "POSITIVE",
    note: "Energetic every time he was on the ball after coming on.",
  },
];

export const b05OpponentObservation = {
  overallEnvironment: null,
  playingStyleTags: ["High press", "Direct build-up"],
  factualSummary: "Kongsberg pressed high after falling behind, then sat deeper once trailing by two in the second half.",
};

export const b05ShapeChangeRows: MatchDetailAfterData["shapeChangeRows"] = [];
export const b05FirstTimeCanonicalPositions: MatchDetailAfterData["firstTimeCanonicalPositions"] = [];

/**
 * Per-match evidence (B2-R4/R8-3) — this literal is the real, unmodified
 * `deriveCombinationsFromSegments()`'s own output (field-for-field, except `createdAt`) for
 * `combination-source-data.ts`'s canonical positional segment and goal-attribution events,
 * curated down to the PARTNERSHIP row this scenario calls out (Noah + Sindre). Verified exactly,
 * not approximated: `shared/__tests__/combination-evidence.test.ts` calls the real function
 * against those SAME source records and asserts this literal equals its output byte-for-byte.
 *
 * NOT computed inline here (unlike the test) — `combination-topology.ts` imports the server-only
 * `db` client at module scope; importing any VALUE from that module (not just its types) pulls
 * `db`/`pg`/Node built-ins into this file's own import graph, which breaks the client bundle for
 * `draft/page.tsx`/`completed/page.tsx` (both `"use client"`) — confirmed by a real CI `Build`
 * failure ("Module not found: Can't resolve 'fs'/'net'/'tls'/...") before this was reverted to a
 * literal. `CombinationEvidenceRow` is imported as a type only, which is erased at compile time
 * and carries no such risk.
 *
 * `opponentDiversity` is always exactly `1` for a single match, and `confidence` can never reach
 * `ESTABLISHED` from one match alone (`deriveConfidence` requires `matchCount >= 3`, hardcoded to
 * `1` on the per-match path — `EMERGING` is the real ceiling) — both are the real derivation's
 * own output, not asserted separately. `createdAt` is the one field NOT from the derivation — the
 * real function stamps non-deterministic wall-clock `new Date()`, replaced here with the fixed
 * `B05_COMPLETED_AT` moment (a real-world fact about this match, not a derivation input).
 */
export const b05CombinationEvidence: CombinationEvidenceRow[] = [
  {
    id: "match-gate-b-05-PARTNERSHIP|HORIZONTAL|player-gb5-noah,player-gb5-sindre|LCM,RCM",
    organisationId: "org-gate-b",
    matchId: B05_MATCH_ID,
    eventMatchId: null,
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    playerIds: ["player-gb5-noah", "player-gb5-sindre"],
    positions: ["LCM", "RCM"],
    minutesTogether: 80,
    goalsForWhilePresent: 3,
    goalsAgainstWhilePresent: 2,
    directGoalContributions: 2,
    directAssistContributions: 0,
    opponentDiversity: 1,
    confidence: "EMERGING",
    approximateTiming: false,
    leagueSeasonId: "season-gate-b",
    createdAt: new Date(B05_COMPLETED_AT),
  },
];

/** The guided debrief (ADR-0152 §3) is already `SUBMITTED` in both the draft and completed
 * fixtures — the real completion gate (`completeReport()`'s `isDebriefSubmittedForReport` check)
 * requires exactly this before `Complete report` can succeed, so a draft report whose debrief
 * isn't yet submitted would be the moment *before* this scenario, not this one. A submitted
 * debrief is necessary but not sufficient, though — `completeReport()` also requires every
 * timing-review blocker resolved (B2-R3); this fixture models both conditions as genuinely
 * separate, independently-satisfiable gates. Identical in both states because it is the same
 * real coach-submitted document either way. */
export const b05DebriefAnswers: DebriefAnswersSection = {
  team_execution: {
    effort: { value: "STRONG" },
    teamCohesion: { value: "OK" },
    positionalShape: { value: "NEEDS_ATTENTION" },
    recoveryBehavior: { value: "STRONG" },
    note: "Slow start but good response after going behind twice.",
  },
  worked: { selected: ["PRESSING"], comment: "Winning the ball back high led directly to the first goal." },
  needs_attention: { selected: ["DEFENSIVE_TRANSITION"], comment: "Conceded twice from turnovers in our own half." },
  match_changes: { option: "WE_CHANGED", description: "Moved to a back three after conceding the second goal.", period: "Second half" },
  opponent_memory: { note: "Kongsberg sat deeper once behind — harder to break down in the final 15 minutes." },
  player_observations: [{ playerId: "player-gb5-elias", observationCode: "WORK_RATE_EFFECTIVE", direction: "POSITIVE", note: "Energetic every time he was on the ball." }],
  anything_else: {},
};

function playerActual(playerId: string, playerName: string, attendanceStatus: "PRESENT" | "NO_SHOW") {
  return {
    id: `actual-${playerId}`,
    playerId,
    playerName,
    coreTeamName: MATCH_B_TEAM_NAME,
    source: "PLANNED",
    attendanceStatus,
    unplannedAppearanceReason: null,
  };
}

function plannedSelection(playerId: string, playerName: string) {
  return { playerId, playerName, coreTeamName: MATCH_B_TEAM_NAME, role: "CORE" };
}

const B05_ROSTER: ReadonlyArray<{ id: string; name: string; status: "PRESENT" | "NO_SHOW" }> = [
  { id: "player-gb5-aksel", name: "Aksel", status: "PRESENT" },
  { id: "player-gb5-tobias", name: "Tobias", status: "PRESENT" },
  { id: "player-gb5-sindre", name: "Sindre", status: "PRESENT" },
  { id: "player-gb5-noah", name: "Noah", status: "PRESENT" },
  { id: "player-gb5-vetle", name: "Vetle", status: "PRESENT" },
  { id: "player-gb5-kasper", name: "Kasper", status: "PRESENT" },
  { id: "player-gb5-elias", name: "Elias", status: "PRESENT" },
  { id: "player-gb5-magnus", name: "Magnus", status: "NO_SHOW" },
];

export const b05AllPlayers = B05_ROSTER.map((p) => ({ id: p.id, name: p.name, teamName: MATCH_B_TEAM_NAME }));

export function b05InitialReport(variant: "draft" | "completed"): MatchReportDetail {
  const goals = b05Goals(variant);
  const assists = b05Assists(variant);
  return {
    id: B05_REPORT_ID,
    matchId: B05_MATCH_ID,
    status: variant === "draft" ? "REPORTED" : "LOCKED",
    homeGoals: 3,
    awayGoals: 2,
    teamNote: "Follow up on positional shape in training this week.",
    completedBy: variant === "draft" ? null : B05_COMPLETED_BY,
    completedAt: variant === "draft" ? null : B05_COMPLETED_AT,
    teamName: MATCH_B_TEAM_NAME,
    opponent: B05_OPPONENT_NAME,
    homeAway: "HOME",
    plannedSelections: B05_ROSTER.map((p) => plannedSelection(p.id, p.name)),
    playerActuals: B05_ROSTER.map((p) => playerActual(p.id, p.name, p.status)),
    absences: [],
    playerStats: goals.map((g) => ({
      id: `stat-${g.id}`,
      playerId: g.participantKey as string,
      playerName: g.playerName ?? "",
      goals: 1,
      assists: 0,
    })).concat(
      assists.map((a) => ({ id: `stat-${a.id}`, playerId: a.participantKey as string, playerName: a.playerName ?? "", goals: 0, assists: 1 })),
    ),
    goals: goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName ?? undefined, minute: g.minute, type: g.type })),
    assists: assists.map((a) => ({ id: a.id, playerId: a.participantKey as string, playerName: a.playerName ?? "", type: a.type })),
  };
}

export function b05AfterData(variant: "draft" | "completed"): MatchDetailAfterData {
  return {
    reportId: B05_REPORT_ID,
    reportStatus: variant === "draft" ? "REPORTED" : "LOCKED",
    homeGoals: 3,
    awayGoals: 2,
    teamNote: "Follow up on positional shape in training this week.",
    completedBy: variant === "draft" ? null : B05_COMPLETED_BY,
    completedAt: variant === "draft" ? null : B05_COMPLETED_AT,
    attendance: b05AttendanceFacts,
    attendanceSummary: b05AttendanceSummary,
    goalScorers: b05GoalScorers(variant),
    assistProviders: b05AssistProviders(variant),
    timeline: b05Timeline,
    playerMinutes: b05MinutesByParticipant,
    playerInvolvement: b05PlayerInvolvement(variant),
    reflection: b05Reflection,
    footballObservations: b05FootballObservations,
    opponentObservation: b05OpponentObservation,
    // B2-R4: `getMatchDetailAfterData()` only ever loads combination evidence for a LOCKED
    // report (`report?.status === "LOCKED" ? getMatchCombinationEvidence(matchId) :
    // Promise.resolve([])`) — a draft report never sees it, regardless of what the UI's
    // "combinations" tab even exists to show (it isn't in the draft tab set at all).
    combinationEvidence: variant === "completed" ? b05CombinationEvidence : [],
    goalAttributionGap: b05GoalAttributionGap(variant),
    timingNeedsReviewCount: variant === "draft" ? 1 : 0,
    outOfRangeEventCount: 0,
    shapeChangeRows: b05ShapeChangeRows,
    firstTimeCanonicalPositions: b05FirstTimeCanonicalPositions,
  };
}
