import {
  summarizeMatchAttendance,
  aggregateGoalScorers,
  aggregateAssistProviders,
  buildMatchTimeline,
  buildPlayerInvolvement,
  type MatchAttendanceFact,
  type MatchGoalFact,
  type MatchAssistFact,
} from "@/lib/matches/match-detail-view-model";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { MatchReportDetail } from "@/app/(app)/matches/[matchId]/post-match/actions";
import type { GoalAttributionGap } from "@/lib/reports/report-mutations";
import type { PostMatchReportTimingReviewRow } from "@/lib/reports/post-match-report-view-model";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { MATCH_B_TEAM_NAME, B05_MATCH_ID, B05_REPORT_ID, B05_OPPONENT_NAME, B05_NOW } from "../../shared/match-b-fixture";

/**
 * B05 "Post-match Report / Draft and completed" (official Gate B register, deferred row):
 * "Finish/report actions versus read-only knowledge." Unlike B01-B04 (four different matches),
 * this is deliberately ONE match's own report moving through its real lifecycle — the register
 * row is specifically about the same report before and after completion, not four unrelated
 * scenarios. `draft/fixtures.ts` and `completed/fixtures.ts` both build their own
 * `MatchDetailAfterData`/`MatchReportDetail` from these shared raw records, differing only in
 * exactly the fields that genuinely differ between the two real lifecycle moments (report status,
 * the second goal's attribution, timing review, completedBy/completedAt) — everything else
 * (score, squad, the other two goals/both assists, the debrief) is identical, because it is the
 * same real match and the same real coach-submitted debrief, not a different one per state.
 *
 * All real production pure functions (`summarizeMatchAttendance`, `aggregateGoalScorers`,
 * `aggregateAssistProviders`, `buildMatchTimeline`, `buildPlayerInvolvement`) are called here,
 * exactly as Gate B W1's own fixtures call `buildMatchPreparationDisplayItems()` — the rendered
 * numbers are the real functions' own output over these raw facts, never a hand-rolled duplicate
 * of what those functions would compute.
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
 * The second goal (34') is deliberately unattributed in the draft fixture and attributed to
 * Sindre in the completed one — this is the one fact this file does NOT share between the two
 * states, because it is the actual thing B05's "finish/report actions" contract demonstrates:
 * the coach resolves the real `GoalAttributionGapBanner` gap (ADR-0147 §4, the 2026-09-17
 * incident's own banner) before completing the report, not after.
 */
export function b05Goals(variant: "draft" | "completed"): MatchGoalFact[] {
  return [
    { id: "goal-gb5-1", participantKey: "player-gb5-noah", playerName: "Noah", minute: 12, type: "NORMAL" },
    {
      id: "goal-gb5-2",
      participantKey: variant === "completed" ? "player-gb5-sindre" : null,
      playerName: variant === "completed" ? "Sindre" : null,
      minute: 34,
      type: "NORMAL",
    },
    { id: "goal-gb5-3", participantKey: "player-gb5-kasper", playerName: "Kasper", minute: 61, type: "NORMAL" },
  ];
}

export const b05Assists: MatchAssistFact[] = [
  { id: "assist-gb5-1", participantKey: "player-gb5-sindre", playerName: "Sindre", type: "NORMAL" },
  { id: "assist-gb5-2", participantKey: "player-gb5-vetle", playerName: "Vetle", type: "NORMAL" },
];

export function b05GoalScorers(variant: "draft" | "completed") {
  return aggregateGoalScorers(b05Goals(variant));
}

export const b05AssistProviders = aggregateAssistProviders(b05Assists);

/** Report-fallback timeline (no canonical live events for this match — a manually-created
 * report, the same real degraded path B03's sparse scenario exercises) — `buildMatchTimeline()`
 * itself decides this via the empty `canonicalLiveEvents` array, not a second branch this fixture
 * invents. */
export function b05Timeline(variant: "draft" | "completed") {
  return buildMatchTimeline({ canonicalLiveEvents: [], reportGoals: b05Goals(variant) });
}

export function b05GoalAttributionGap(variant: "draft" | "completed"): GoalAttributionGap {
  return variant === "draft"
    ? { liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true }
    : { liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false };
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

const b05MinutesByParticipant = new Map<string, number>([
  ["player-gb5-aksel", 90],
  ["player-gb5-tobias", 90],
  ["player-gb5-sindre", 90],
  ["player-gb5-noah", 83],
  ["player-gb5-vetle", 90],
  ["player-gb5-kasper", 68],
  ["player-gb5-elias", 22],
]);

const b05ObservationCountByParticipant = new Map<string, number>([["player-gb5-elias", 1]]);

const b05PresentParticipants = b05AttendanceFacts
  .filter((a) => a.attendanceStatus === "PRESENT")
  .map((a) => ({ participantKey: `player-gb5-${a.playerName.toLowerCase()}`, playerName: a.playerName }));

export function b05PlayerInvolvement(variant: "draft" | "completed") {
  return buildPlayerInvolvement({
    presentParticipants: b05PresentParticipants,
    goals: b05Goals(variant),
    assists: b05Assists,
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

/** Satisfies `MatchDetailAfterData`'s shared shape — these two fields are Match Details
 * AFTER-tab concepts (`WhatThisMatchAddedPanel`/positional history), not rendered by any
 * Post-Match Report component B05 composes. Always empty here, documented rather than omitted
 * silently. */
export const b05ShapeChangeRows: MatchDetailAfterData["shapeChangeRows"] = [];
export const b05FirstTimeCanonicalPositions: MatchDetailAfterData["firstTimeCanonicalPositions"] = [];

export const b05CombinationEvidence: CombinationEvidenceRow[] = [
  {
    id: "comb-gb5-1",
    organisationId: "org-gate-b",
    matchId: B05_MATCH_ID,
    eventMatchId: null,
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    playerIds: ["player-gb5-noah", "player-gb5-sindre"],
    positions: ["RCM", "LCM"],
    minutesTogether: 83,
    goalsForWhilePresent: 2,
    goalsAgainstWhilePresent: 1,
    directGoalContributions: 1,
    directAssistContributions: 1,
    opponentDiversity: 3,
    confidence: "ESTABLISHED",
    approximateTiming: false,
    leagueSeasonId: "season-gate-b",
    createdAt: B05_NOW,
  },
  {
    id: "comb-gb5-2",
    organisationId: "org-gate-b",
    matchId: B05_MATCH_ID,
    eventMatchId: null,
    family: "TRIANGLE",
    subtype: "ATTACKING",
    playerIds: ["player-gb5-noah", "player-gb5-sindre", "player-gb5-kasper"],
    positions: ["RCM", "LCM", "CF"],
    minutesTogether: 68,
    goalsForWhilePresent: 2,
    goalsAgainstWhilePresent: 0,
    directGoalContributions: 2,
    directAssistContributions: 1,
    opponentDiversity: 2,
    confidence: "EMERGING",
    approximateTiming: true,
    leagueSeasonId: "season-gate-b",
    createdAt: B05_NOW,
  },
];

/** The guided debrief (ADR-0152 §3) is already `SUBMITTED` in both the draft and completed
 * fixtures — the real completion gate (`completeReport()`'s `isDebriefSubmittedForReport` check)
 * requires exactly this before `Complete report` can succeed, so a draft report whose debrief
 * isn't yet submitted would be the moment *before* this scenario, not this one. Identical in both
 * states because it is the same real coach-submitted document either way. */
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
    playerStats: [
      { id: "stat-gb5-noah", playerId: "player-gb5-noah", playerName: "Noah", goals: 1, assists: 0 },
      { id: "stat-gb5-sindre", playerId: "player-gb5-sindre", playerName: "Sindre", goals: variant === "completed" ? 1 : 0, assists: 1 },
      { id: "stat-gb5-kasper", playerId: "player-gb5-kasper", playerName: "Kasper", goals: 1, assists: 0 },
      { id: "stat-gb5-vetle", playerId: "player-gb5-vetle", playerName: "Vetle", goals: 0, assists: 1 },
    ],
    goals: goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName ?? undefined, minute: g.minute, type: g.type })),
    assists: b05Assists.map((a) => ({ id: a.id, playerId: a.participantKey as string, playerName: a.playerName ?? "", type: a.type })),
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
    assistProviders: b05AssistProviders,
    timeline: b05Timeline(variant),
    playerMinutes: b05MinutesByParticipant,
    playerInvolvement: b05PlayerInvolvement(variant),
    reflection: b05Reflection,
    footballObservations: b05FootballObservations,
    opponentObservation: b05OpponentObservation,
    combinationEvidence: b05CombinationEvidence,
    goalAttributionGap: b05GoalAttributionGap(variant),
    timingNeedsReviewCount: variant === "draft" ? 1 : 0,
    outOfRangeEventCount: 0,
    shapeChangeRows: b05ShapeChangeRows,
    firstTimeCanonicalPositions: b05FirstTimeCanonicalPositions,
  };
}
