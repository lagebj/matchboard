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
import type { CombinationEvidenceRow, MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";
import { MATCH_B_TEAM_NAME, type MatchBSquadMember } from "../../shared/match-b-fixture";
import { B08_MATCH_FORMAT, B08_MATCH_ID, B08_REPORT_ID, B08_OPPONENT_NAME, B08_COMPLETED_AT, B08_COMPLETED_BY, globalMinuteToPeriodRelative, b08Squad } from "./fixture";

/**
 * B08's one canonical match history — every one of the five lifecycle candidates (BEFORE/LIVE/
 * AFTER/REPORT-DRAFT/REPORT-COMPLETED) reads from this module, never a second interpretation of
 * the same match. Mirrors the real, already-shipped `b05-post-match-report/shared/report-data.ts`
 * + `combination-source-data.ts` pattern (same aggregate functions, same period-relative time
 * contract, same server-only-import discipline for combination evidence — see
 * `docs/ui-lab/gate-b-w5-candidates/CURRENT_STATE_AUDIT.md` §5/§7), parameterized with B08's own
 * match identity instead of B05's.
 *
 * Final result: 2-1 (home win). Three real goal events: Vetle scores unassisted at 10' (1-0);
 * Vollen equalizes at 22' (1-1); Noah scores at 48', assisted by Sindre (2-1, final). Slemmestad
 * never trails and never leads by more than one goal at any point — checked directly in
 * `__tests__/fixture-history.test.ts`, never assumed.
 *
 * The one genuine incomplete-data condition this fixture carries (DRAFT only, resolved by
 * COMPLETED): the second half's running-clock duration has not yet been confirmed
 * (`b08TimingReview("draft")` -> `needsReview: true`), which is the real blocker
 * `getTimingSubmissionBlockers()`/`useSafeReportLifecycle`'s own `complete()` action enforces —
 * not a hand-faked warning panel. Goal attribution itself has no gap in either variant (both
 * report Goal rows exist from the start) — the incomplete-data axis for B08 is timing, not
 * attribution, deliberately distinct from B05's own (already-demonstrated) attribution-gap
 * scenario.
 */

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

const B08_ROSTER: ReadonlyArray<{ id: string; name: string; status: "PRESENT" | "NO_SHOW" }> = [
  { id: "player-gb8-jonas", name: "Jonas", status: "PRESENT" },
  { id: "player-gb8-theodor", name: "Theodor", status: "PRESENT" },
  { id: "player-gb8-markus", name: "Markus", status: "PRESENT" },
  { id: "player-gb8-sindre", name: "Sindre", status: "PRESENT" },
  { id: "player-gb8-kasper", name: "Kasper", status: "PRESENT" },
  { id: "player-gb8-noah", name: "Noah", status: "PRESENT" },
  { id: "player-gb8-vetle", name: "Vetle", status: "PRESENT" },
  { id: "player-gb8-elias", name: "Elias", status: "PRESENT" },
  { id: "player-gb8-magnus", name: "Magnus", status: "NO_SHOW" },
];

export const b08AttendanceFacts: MatchAttendanceFact[] = B08_ROSTER.map((p) => ({ attendanceStatus: p.status, playerName: p.name }));
export const b08AttendanceSummary = summarizeMatchAttendance(b08AttendanceFacts);
export const b08AllPlayers = B08_ROSTER.map((p) => ({ id: p.id, name: p.name, teamName: MATCH_B_TEAM_NAME }));

export const b08PresentParticipants = B08_ROSTER.filter((p) => p.status === "PRESENT").map((p) => ({ participantKey: p.id, playerName: p.name }));

// ---------------------------------------------------------------------------
// Canonical live events — the one true historical record, identical in every lifecycle state
// ---------------------------------------------------------------------------

export const b08CanonicalLiveEvents: MatchCanonicalLiveEventFact[] = [
  { id: "live-gb8-goal-1", eventType: "GOAL_FOR", playerName: null, clientEventId: "client-gb8-goal-1", correctsEventId: null, minuteLabel: "10'", ...globalMinuteToPeriodRelative(10, B08_MATCH_FORMAT) },
  { id: "live-gb8-scorer-1", eventType: "SCORER_SET", playerName: "Vetle", clientEventId: null, correctsEventId: "client-gb8-goal-1", minuteLabel: null, ...globalMinuteToPeriodRelative(10, B08_MATCH_FORMAT) },
  { id: "live-gb8-goal-against-1", eventType: "GOAL_AGAINST", playerName: null, clientEventId: "client-gb8-goal-against-1", correctsEventId: null, minuteLabel: "22'", ...globalMinuteToPeriodRelative(22, B08_MATCH_FORMAT) },
  { id: "live-gb8-goal-2", eventType: "GOAL_FOR", playerName: null, clientEventId: "client-gb8-goal-2", correctsEventId: null, minuteLabel: "48'", ...globalMinuteToPeriodRelative(48, B08_MATCH_FORMAT) },
  { id: "live-gb8-scorer-2", eventType: "SCORER_SET", playerName: "Noah", clientEventId: null, correctsEventId: "client-gb8-goal-2", minuteLabel: null, ...globalMinuteToPeriodRelative(48, B08_MATCH_FORMAT) },
  { id: "live-gb8-assist-2", eventType: "ASSIST_SET", playerName: "Sindre", clientEventId: null, correctsEventId: "client-gb8-goal-2", minuteLabel: null, ...globalMinuteToPeriodRelative(48, B08_MATCH_FORMAT) },
];

export const B08_LIVE_GOALS_RECORDED = b08CanonicalLiveEvents.filter((e) => e.eventType === "GOAL_FOR").length;

export const b08Timeline = buildMatchTimeline({ canonicalLiveEvents: b08CanonicalLiveEvents, reportGoals: [] });

// ---------------------------------------------------------------------------
// Report rows — identical in draft and completed (no goal-attribution gap for this scenario)
// ---------------------------------------------------------------------------

export function b08Goals(_variant: "draft" | "completed"): MatchGoalFact[] {
  return [
    { id: "goal-gb8-1", participantKey: "player-gb8-vetle", playerName: "Vetle", minute: 10, type: "NORMAL" },
    { id: "goal-gb8-2", participantKey: "player-gb8-noah", playerName: "Noah", minute: 48, type: "NORMAL" },
  ];
}

export function b08Assists(_variant: "draft" | "completed"): MatchAssistFact[] {
  return [{ id: "assist-gb8-1", participantKey: "player-gb8-sindre", playerName: "Sindre", type: "NORMAL" }];
}

export function b08GoalScorers(variant: "draft" | "completed") {
  return aggregateGoalScorers(b08Goals(variant));
}

export function b08AssistProviders(variant: "draft" | "completed") {
  return aggregateAssistProviders(b08Assists(variant));
}

export function b08GoalAttributionGap(variant: "draft" | "completed"): GoalAttributionGap {
  const attributedGoals = b08Goals(variant).length;
  return { liveGoalsRecorded: B08_LIVE_GOALS_RECORDED, attributedGoals, hasGap: attributedGoals < B08_LIVE_GOALS_RECORDED };
}

/** The one genuine incomplete-data condition in this fixture: the second half's duration is
 * unconfirmed in DRAFT (a plausible slightly-short running-clock reading, comfortably covering
 * every real period-2 event's own `matchSeconds` — max 18', well under 27') and confirmed to the
 * real 30-minute period duration once reviewed in COMPLETED. This is the exact real blocker
 * `useSafeReportLifecycle`'s `complete()` action enforces (mirrors
 * `b05-post-match-report/shared/report-data.ts`'s own `b05TimingReview`). */
export function b08TimingReview(variant: "draft" | "completed"): PostMatchReportTimingReviewRow[] {
  return [
    {
      period: "SECOND_HALF",
      periodLabel: "Second half",
      resolvedDurationMinutes: variant === "draft" ? 27 : B08_MATCH_FORMAT.periodDurationMinutes,
      needsReview: variant === "draft",
    },
  ];
}

export const b08MinutesByParticipant = new Map<string, number>([
  ["player-gb8-jonas", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-theodor", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-markus", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-sindre", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-kasper", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-noah", B08_MATCH_FORMAT.regulationDurationMinutes],
  ["player-gb8-vetle", B08_MATCH_FORMAT.regulationDurationMinutes],
  // Elias attends (PRESENT) but is never fielded — a real 0-minute present reserve, not an
  // unexplained gap: he does not appear in `b08PositionalSegments` below either.
  ["player-gb8-elias", 0],
]);

export const b08ObservationCountByParticipant = new Map<string, number>([["player-gb8-noah", 1]]);

export function b08PlayerInvolvement(variant: "draft" | "completed") {
  return buildPlayerInvolvement({
    presentParticipants: b08PresentParticipants,
    goals: b08Goals(variant),
    assists: b08Assists(variant),
    observationCountByParticipant: b08ObservationCountByParticipant,
    minutesByParticipant: b08MinutesByParticipant,
  });
}

// ---------------------------------------------------------------------------
// Reflection, observations, debrief — one real coach-authored document, identical in both variants
// ---------------------------------------------------------------------------

export const b08Reflection = {
  effort: "STRONG",
  teamCohesion: "OK",
  positionalShape: "NEEDS_ATTENTION",
  recoveryBehavior: "STRONG",
  note: "Composed response after conceding the equalizer — we regained the lead and controlled the closing stages, but we must stay switched on defensively in transition.",
};

export const b08FootballObservations = [
  {
    id: "obs-gb8-1",
    playerId: "player-gb8-noah",
    playerName: "Noah",
    observationCode: "TEAM_COMBINATION_EFFECTIVE",
    polarity: "POSITIVE",
    note: "Combination with Sindre down the left created our second goal.",
  },
];

export const b08OpponentObservation = {
  overallEnvironment: null,
  playingStyleTags: ["High press", "Direct build-up"],
  factualSummary: "Vollen pressed high after equalizing at 22' but created no clear chance once we regained the lead at 48'.",
};

export const b08ShapeChangeRows: MatchDetailAfterData["shapeChangeRows"] = [];
export const b08FirstTimeCanonicalPositions: MatchDetailAfterData["firstTimeCanonicalPositions"] = [];

export const b08DebriefAnswers: DebriefAnswersSection = {
  team_execution: {
    effort: { value: "STRONG" },
    teamCohesion: { value: "OK" },
    positionalShape: { value: "NEEDS_ATTENTION" },
    recoveryBehavior: { value: "STRONG" },
    note: b08Reflection.note,
  },
  worked: { selected: ["PRESSING"], comment: "Winning the ball back high led directly to our second goal." },
  needs_attention: { selected: ["DEFENSIVE_TRANSITION"], comment: "Lost our shape in transition right before their equalizer." },
  match_changes: { option: "NO_MEANINGFUL_CHANGE", description: "Stayed in the same shape throughout and just asked the midfield to press higher after conceding." },
  opponent_memory: { note: "Vollen pressed high after equalizing but could not create a clear chance once we regained the lead." },
  player_observations: [{ playerId: "player-gb8-noah", observationCode: "TEAM_COMBINATION_EFFECTIVE", direction: "POSITIVE", note: "Combination with Sindre down the left created our second goal." }],
  anything_else: {},
};

// ---------------------------------------------------------------------------
// Report detail + after-data read models
// ---------------------------------------------------------------------------

function b08PlayerActual(playerId: string, playerName: string, attendanceStatus: "PRESENT" | "NO_SHOW") {
  return { id: `actual-${playerId}`, playerId, playerName, coreTeamName: MATCH_B_TEAM_NAME, source: "PLANNED", attendanceStatus, unplannedAppearanceReason: null };
}

function b08PlannedSelection(playerId: string, playerName: string) {
  return { playerId, playerName, coreTeamName: MATCH_B_TEAM_NAME, role: "CORE" };
}

export function b08InitialReport(variant: "draft" | "completed"): MatchReportDetail {
  const goals = b08Goals(variant);
  const assists = b08Assists(variant);
  return {
    id: B08_REPORT_ID,
    matchId: B08_MATCH_ID,
    status: variant === "draft" ? "REPORTED" : "LOCKED",
    homeGoals: 2,
    awayGoals: 1,
    teamNote: "Review defensive transitions in training this week — same pattern that led to their equalizer.",
    completedBy: variant === "draft" ? null : B08_COMPLETED_BY,
    completedAt: variant === "draft" ? null : B08_COMPLETED_AT.toISOString(),
    teamName: MATCH_B_TEAM_NAME,
    opponent: B08_OPPONENT_NAME,
    homeAway: "HOME",
    plannedSelections: B08_ROSTER.map((p) => b08PlannedSelection(p.id, p.name)),
    playerActuals: B08_ROSTER.map((p) => b08PlayerActual(p.id, p.name, p.status)),
    absences: [],
    playerStats: goals
      .map((g) => ({ id: `stat-${g.id}`, playerId: g.participantKey as string, playerName: g.playerName ?? "", goals: 1, assists: 0 }))
      .concat(assists.map((a) => ({ id: `stat-${a.id}`, playerId: a.participantKey as string, playerName: a.playerName ?? "", goals: 0, assists: 1 }))),
    goals: goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName ?? undefined, minute: g.minute, type: g.type })),
    assists: assists.map((a) => ({ id: a.id, playerId: a.participantKey as string, playerName: a.playerName ?? "", type: a.type })),
  };
}

export function b08AfterData(variant: "draft" | "completed"): MatchDetailAfterData {
  return {
    reportId: B08_REPORT_ID,
    reportStatus: variant === "draft" ? "REPORTED" : "LOCKED",
    homeGoals: 2,
    awayGoals: 1,
    teamNote: "Review defensive transitions in training this week — same pattern that led to their equalizer.",
    completedBy: variant === "draft" ? null : B08_COMPLETED_BY,
    completedAt: variant === "draft" ? null : B08_COMPLETED_AT.toISOString(),
    attendance: b08AttendanceFacts,
    attendanceSummary: b08AttendanceSummary,
    goalScorers: b08GoalScorers(variant),
    assistProviders: b08AssistProviders(variant),
    timeline: b08Timeline,
    playerMinutes: b08MinutesByParticipant,
    playerInvolvement: b08PlayerInvolvement(variant),
    reflection: b08Reflection,
    footballObservations: b08FootballObservations,
    opponentObservation: b08OpponentObservation,
    // Matches production's own `getMatchDetailAfterData()` rule exactly: combination evidence is
    // only ever loaded for a LOCKED report.
    combinationEvidence: variant === "completed" ? b08CombinationEvidence : [],
    goalAttributionGap: b08GoalAttributionGap(variant),
    timingNeedsReviewCount: variant === "draft" ? 1 : 0,
    outOfRangeEventCount: 0,
    shapeChangeRows: b08ShapeChangeRows,
    firstTimeCanonicalPositions: b08FirstTimeCanonicalPositions,
  };
}

// ---------------------------------------------------------------------------
// Combination evidence — hand-written literal, independently verified against the real
// `deriveCombinationsFromSegments()` in __tests__/combination-evidence.test.ts. NEVER computed
// inline here: `combination-topology.ts` imports the server-only `db` client at module scope, and
// importing any VALUE (not just its types) from that module pulls `db`/`pg`/Node builtins into
// this file's own import graph, breaking the client bundle for every B08 page that imports this
// module (confirmed real CI `Build` failure precedent — see CURRENT_STATE_AUDIT.md §7).
// ---------------------------------------------------------------------------

export type PositionalParticipant = { participantId: string; playerName: string; position: string; line: string; lane: string };
export type PositionalSegmentSource = { startMs: number; endMs: number; participants: PositionalParticipant[] };

/** The full real NFF G11 7v7 formation, one continuous segment spanning the whole match — no
 * substitutions (`b08RotationEvents` below is explicitly empty), Elias (reserve) never fielded. */
export const b08PositionalSegments: PositionalSegmentSource[] = [
  {
    startMs: 0,
    endMs: B08_MATCH_FORMAT.regulationDurationMinutes * 60_000,
    participants: [
      { participantId: "player-gb8-jonas", playerName: "Jonas", position: "GK", line: "GK", lane: "CENTRE" },
      { participantId: "player-gb8-theodor", playerName: "Theodor", position: "LCB", line: "DEF", lane: "LEFT" },
      { participantId: "player-gb8-markus", playerName: "Markus", position: "RCB", line: "DEF", lane: "RIGHT" },
      { participantId: "player-gb8-sindre", playerName: "Sindre", position: "LCM", line: "MID", lane: "LEFT" },
      { participantId: "player-gb8-kasper", playerName: "Kasper", position: "CM", line: "MID", lane: "CENTRE" },
      { participantId: "player-gb8-noah", playerName: "Noah", position: "RCM", line: "MID", lane: "RIGHT" },
      { participantId: "player-gb8-vetle", playerName: "Vetle", position: "CF", line: "ATT", lane: "CENTRE" },
    ],
  },
];

export const b08RotationEvents: ReadonlyArray<{ matchMs: number; playerOffId: string; playerOnId: string; position: string }> = [];

/** Matches `b08CanonicalLiveEvents` exactly, re-expressed in the `GoalAttributionEvent` shape
 * `deriveCombinationsFromSegments()` consumes — never a second, disconnected event list. */
export const b08GoalAttributionEvents: GoalAttributionEvent[] = [
  { matchMs: 10 * 60_000, team: "FOR", scorerPlayerId: "player-gb8-vetle", assistPlayerId: null, approximateTiming: false },
  { matchMs: 22 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 48 * 60_000, team: "FOR", scorerPlayerId: "player-gb8-noah", assistPlayerId: "player-gb8-sindre", approximateTiming: false },
];

export function toMatchSegments(segments: PositionalSegmentSource[]): MatchSegment[] {
  return segments.map((segment) => {
    const playersOnPitch = new Map<string, PlayerSlot>(segment.participants.map((p) => [p.participantId, { position: p.position, line: p.line, lane: p.lane }]));
    return { startMs: segment.startMs, endMs: segment.endMs, playersOnPitch };
  });
}

/**
 * The Noah (RCM) + Sindre (LCM) partnership — the one real combination this scenario calls out
 * (Noah scored the 48' winner, Sindre assisted it, both present the full 60 minutes). This
 * literal is the real `deriveCombinationsFromSegments()`'s own output for `b08PositionalSegments`/
 * `b08GoalAttributionEvents` above, verified byte-for-byte (except `createdAt`) in
 * `__tests__/combination-evidence.test.ts`. `createdAt` is replaced with the fixed
 * `B08_COMPLETED_AT` moment (a real-world fact about this match) in place of the real function's
 * own non-deterministic `new Date()` stamp.
 */
export const b08CombinationEvidence: CombinationEvidenceRow[] = [
  {
    id: "match-gate-b-08-PARTNERSHIP|HORIZONTAL|player-gb8-noah,player-gb8-sindre|LCM,RCM",
    organisationId: "org-gate-b",
    matchId: B08_MATCH_ID,
    eventMatchId: null,
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    playerIds: ["player-gb8-noah", "player-gb8-sindre"],
    positions: ["LCM", "RCM"],
    minutesTogether: B08_MATCH_FORMAT.regulationDurationMinutes,
    goalsForWhilePresent: 2,
    goalsAgainstWhilePresent: 1,
    directGoalContributions: 1,
    directAssistContributions: 1,
    opponentDiversity: 1,
    confidence: "EMERGING",
    approximateTiming: false,
    leagueSeasonId: "season-gate-b",
    createdAt: new Date(B08_COMPLETED_AT),
  },
];

export const b08SquadForHash: readonly MatchBSquadMember[] = b08Squad;
