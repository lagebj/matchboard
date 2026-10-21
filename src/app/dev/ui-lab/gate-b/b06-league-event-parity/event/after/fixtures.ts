import type { FixtureIdentity } from "../../../../gate-a/shared/fixture-identity";
import {
  b06EventAfterIdentity,
  B06_EVENT_NAME,
  B06_EVENT_SQUAD_NAME,
  B06_EVENT_OPPONENT_NAME,
  B06_EVENT_MATCH_ID as SHARED_B06_EVENT_MATCH_ID,
  B06_EVENT_NOW,
} from "../../../shared/match-b-fixture";

export const B06_EVENT_MATCH_ID = SHARED_B06_EVENT_MATCH_ID;
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
  PostMatchAvailablePlayer,
  PostMatchReportTimingReviewRow,
} from "@/lib/reports/post-match-report-view-model";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import type { DebriefAnswersSection } from "@/lib/post-match/debrief/v1";

/**
 * B06 Event · After — completed, report locked (read-only). Reuses the REAL shared
 * `PostMatchReportShell` (ARR-0034, `src/components/matches/post-match-report-shell.tsx`)
 * directly — unlike `EventMatchReportPanel`, this shell takes `report`/`actions`/`capabilities`
 * as plain props with no internal self-fetching, so it is genuinely fixture-injectable, same as
 * League's B05 candidate reuses `PostMatchReportPageShell`. Deliberately the LOCKED state only
 * (not a draft/completed toggle like B05) — B06's job is lifecycle/navigation parity across
 * origins, not re-demonstrating the editable-vs-locked distinction B05 already covers.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B06-EVENT-AFTER",
  fixtureId: "gate-b-w3-b06-event-after",
  fixtureVersion: 1,
  fixtureSha256: "1bd0d915689515896990822a6a5a36c8eb093b2beee6a29eaf976975025ee81b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B06_EVENT_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b06EventAfterIdentity;
export const eventName = B06_EVENT_NAME;
export const eventSquadName = B06_EVENT_SQUAD_NAME;
export const opponentName = B06_EVENT_OPPONENT_NAME;

export const B06_EVENT_REPORT_ID = "report-gate-b-06-event";
export const B06_EVENT_COMPLETED_AT = new Date("2026-10-29T15:05:00.000Z").toISOString();
export const B06_EVENT_COMPLETED_BY = "Marte Johansen";

export const timingReview: PostMatchReportTimingReviewRow[] = [
  { period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 45, needsReview: false },
];

export const report: PostMatchReportViewModel = {
  id: B06_EVENT_REPORT_ID,
  status: "LOCKED",
  teamLabel: eventSquadName,
  opponentLabel: opponentName,
  ourScore: 3,
  opponentScore: 1,
  players: [
    { id: "actual-gb6e-oskar", playerId: "participant-gb6e-oskar", playerName: "Oskar", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-theodor", playerId: "participant-gb6e-theodor", playerName: "Theodor", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-markus", playerId: "participant-gb6e-markus", playerName: "Markus", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-sindre", playerId: "participant-gb6e-sindre", playerName: "Sindre", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-kasper", playerId: "participant-gb6e-kasper", playerName: "Kasper", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-jonas", playerId: "participant-gb6e-jonas", playerName: "Jonas", attendanceStatus: "PRESENT", meta: "Planned helper from Slemmestad Blå — Cup Squad" },
    { id: "actual-gb6e-noah", playerId: "participant-gb6e-noah", playerName: "Noah", attendanceStatus: "PRESENT" },
    { id: "actual-gb6e-william", playerId: "participant-gb6e-william", playerName: "William (Guest)", attendanceStatus: "PRESENT" },
  ],
  goals: [
    { id: "goal-gb6e-1", playerId: "participant-gb6e-noah", playerName: "Noah", minute: 12 },
    { id: "goal-gb6e-2", playerId: "participant-gb6e-sindre", playerName: "Sindre", minute: 34 },
    { id: "goal-gb6e-3", playerId: "participant-gb6e-kasper", playerName: "Kasper", minute: 70 },
  ],
  assists: [{ id: "assist-gb6e-1", playerId: "participant-gb6e-kasper", playerName: "Kasper" }],
  completedBy: B06_EVENT_COMPLETED_BY,
  completedAt: B06_EVENT_COMPLETED_AT,
  timingReview,
  outOfRangeEventCount: 0,
};

export const capabilities: PostMatchReportCapabilities = { hasUnplannedReason: false };

export const availablePlayers: PostMatchAvailablePlayer[] = [];

/** Every mutating action is honest, not fake — LOCKED hides add/remove/complete in the real
 * shell, leaving only `reopen` reachable; it resolves to a genuine (non-silent) failure rather
 * than pretending to succeed, since this candidate is never wired to a production mutation. */
function notWired(): Promise<{ success: boolean; error?: string }> {
  return Promise.resolve({ success: false, error: "UI Lab candidate — not wired to a production mutation." });
}

export const actions: PostMatchReportActions = {
  updateResult: notWired,
  addGoal: notWired,
  removeGoal: notWired,
  addAssist: notWired,
  removeAssist: notWired,
  updateAttendance: notWired,
  addPlayer: notWired,
  removePlayer: notWired,
  complete: notWired,
  reopen: notWired,
  confirmPeriodTiming: notWired,
  correctPeriodTiming: notWired,
};

export const debriefAnswers: DebriefAnswersSection = {
  team_execution: {
    effort: { value: "STRONG" },
    teamCohesion: { value: "OK" },
    positionalShape: { value: "NEEDS_ATTENTION" },
    recoveryBehavior: { value: "STRONG" },
    note: "Strong second-half response after conceding.",
  },
  worked: { selected: ["PRESSING"], comment: "High press forced the turnover before the second goal." },
  needs_attention: { selected: ["DEFENSIVE_TRANSITION"], comment: "Conceded from a turnover in our own half." },
  match_changes: { option: "WE_CHANGED", description: "Moved William forward to add width.", period: "Second half" },
  opponent_memory: { note: "Rykkinn sat deeper once behind — harder to break down late." },
  player_observations: [{ playerId: "participant-gb6e-william", observationCode: "WORK_RATE_EFFECTIVE", direction: "POSITIVE", note: "Covered a lot of ground for a guest appearance." }],
  anything_else: {},
};

export const footballObservations = [
  {
    id: "obs-gb6e-1",
    playerId: "participant-gb6e-william",
    observationCode: "WORK_RATE_EFFECTIVE",
    polarity: "POSITIVE" as const,
    note: "Covered a lot of ground for a guest appearance.",
    observedAt: B06_EVENT_COMPLETED_AT,
  },
];

/** Same evidence system League's B04/B05 use (`CombinationEvidenceRow`) — `eventMatchId` set,
 * `matchId` null, and `leagueSeasonId` still populated because Event matches resolve an evidence
 * season by date-range (`buildEventMatchRef()`, `src/lib/evidence/adapters/
 * event-evidence-adapter.ts`), not because Event has its own League season. */
export const combinationEvidence: CombinationEvidenceRow[] = [
  {
    id: "comb-gb6e-1",
    organisationId: "org-gate-b",
    matchId: null,
    eventMatchId: B06_EVENT_MATCH_ID,
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    playerIds: ["participant-gb6e-noah", "participant-gb6e-sindre"],
    positions: ["CF", "LCM"],
    minutesTogether: 80,
    goalsForWhilePresent: 2,
    goalsAgainstWhilePresent: 1,
    directGoalContributions: 2,
    directAssistContributions: 0,
    opponentDiversity: 2,
    confidence: "EMERGING",
    approximateTiming: true,
    leagueSeasonId: "season-gate-b-06",
    createdAt: B06_EVENT_NOW,
  },
];

export const rawRecordsForHash = { matchIdentity, report, debriefAnswers, footballObservations, combinationEvidence };
