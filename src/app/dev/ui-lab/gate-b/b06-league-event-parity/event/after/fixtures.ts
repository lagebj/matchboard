import type { FixtureIdentity } from "../../../../gate-a/shared/fixture-identity";
import {
  b06EventAfterIdentity,
  B06_EVENT_NAME,
  B06_EVENT_SQUAD_NAME,
  B06_EVENT_OPPONENT_NAME,
  B06_EVENT_MATCH_ID as SHARED_B06_EVENT_MATCH_ID,
  B06_EVENT_AFTER_REFERENCE_AT,
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
import { b06EventAfterPositionalSegment, b06EventAfterGoalAttributionEvents } from "./combination-source-data";

/**
 * B06 Event · After — completed, report locked (read-only). Reuses the REAL shared
 * `PostMatchReportShell` (ARR-0034, `src/components/matches/post-match-report-shell.tsx`)
 * directly — unlike `EventMatchReportPanel`, this shell takes `report`/`actions`/`capabilities`
 * as plain props with no internal self-fetching, so it is genuinely fixture-injectable, same as
 * League's B05 candidate reuses `PostMatchReportPageShell`. Deliberately the LOCKED state only
 * (not a draft/completed toggle like B05) — B06's job is lifecycle/navigation parity across
 * origins, not re-demonstrating the editable-vs-locked distinction B05 already covers.
 *
 * Never approved at any prior version, so no historical-approval preservation is needed here
 * (contrast B05, see candidate_manifest.json). fixtureVersion 3 (B5/R2/B5/R6) corrected two
 * verified findings: William (`participant-gb6e-william`, a Guest Player) is no longer the
 * subject of `debriefAnswers.player_observations` (B5/R2); the Noah+Sindre combination row's
 * `subtype` is `VERTICAL`, not `HORIZONTAL` (B5/R6 — CF and LCM are different lines).
 *
 * fixtureVersion 4 (R8-3) — `combinationEvidence` is now COMPUTED by calling the real
 * `deriveCombinationsFromSegments()` directly against `combination-source-data.ts`'s own
 * canonical positional/goal-attribution records (previously hand-written; verified in
 * `__tests__/combination-evidence.test.ts` to equal the real function's own output exactly).
 * Those source records are now also material to this fixture's own hash.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B06-EVENT-AFTER",
  fixtureId: "gate-b-w3-b06-event-after",
  fixtureVersion: 4,
  fixtureSha256: "a14895d34fc326092f70dc3719ceffb9db3168b63213d0576b59d547961ce34e",
  sourceClass: "SYNTHETIC_LABELED",
  // B3-R4: after the real completion time, never before kickoff.
  fixedDateTimeUtc: B06_EVENT_AFTER_REFERENCE_AT.toISOString(),
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

/**
 * B5/R2 — `player_observations` never names William (`participant-gb6e-william`, a
 * `GUEST_PLAYER`): production's debrief-submission path can promote a structured individual
 * `player_observations` entry into `createFootballObservations()`, which requires an active
 * canonical `Player` row (`db.player.findFirst(...)`) — `PlayerDevelopmentObservation.playerId`
 * has no `GuestPlayer` counterpart at all (ADR-0106: "structurally incapable of referencing a
 * GuestPlayer"). William's real, valid participation (lineup slot, attendance, the match-day
 * narrative) stays intact in `match_changes.description` and `report.players` — only the
 * structured, Player-backed observation record is reassigned, to Theodor (a real `PLAYER`
 * participant), matching `footballObservations` below exactly rather than inventing a second,
 * disconnected reassignment target.
 */
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
  player_observations: [{ playerId: "participant-gb6e-theodor", observationCode: "WORK_RATE_EFFECTIVE", direction: "POSITIVE", note: "Won every first-contact duel at centre-back through a difficult second half." }],
  anything_else: {},
};

/**
 * B3-R3: never William — production `createFootballObservations()` requires an active
 * canonical `Player` row (`db.player.findFirst(...)`); `PlayerDevelopmentObservation.playerId`
 * is non-nullable with no `GuestPlayer` counterpart at all (ADR-0106 verifies this exact
 * boundary: "structurally incapable of referencing a GuestPlayer"). William's real, valid
 * participation (lineup slot, attendance, the debrief's own qualitative note about his game)
 * is preserved elsewhere in this fixture — only the longitudinal development-evidence record is
 * reassigned, to Theodor, a real Player-type participant.
 */
export const footballObservations = [
  {
    id: "obs-gb6e-1",
    playerId: "participant-gb6e-theodor",
    observationCode: "WORK_RATE_EFFECTIVE",
    polarity: "POSITIVE" as const,
    note: "Won every first-contact duel at centre-back through a difficult second half.",
    observedAt: B06_EVENT_COMPLETED_AT,
  },
];

/**
 * Same evidence system League's B04/B05 use (`CombinationEvidenceRow`) — `eventMatchId` set,
 * `matchId` null, and `leagueSeasonId` still populated because Event matches resolve an evidence
 * season by date-range (`buildEventMatchRef()`, `src/lib/evidence/adapters/
 * event-evidence-adapter.ts`), not because Event has its own League season.
 *
 * B3-R7: corrected to the real per-match derivation rules (same as B2-R4's League fix) —
 * `opponentDiversity` is always exactly `1` for a single match, and `confidence` can never be
 * `ESTABLISHED` from one match alone (`deriveConfidence` requires `matchCount >= 3`, hardcoded
 * to `1` on the per-match path). `createdAt` is after the match completes, never before kickoff.
 *
 * B5/R6: `subtype` corrected from `HORIZONTAL` to `VERTICAL`. Noah plays CF (`FormationSlotRoleType
 * FORWARD` -> `ROLE_TYPE_TO_LINE.FORWARD` = `"ATT"`) and Sindre plays LCM (`MIDFIELDER` ->
 * `"MID"`) — two DIFFERENT lines, so the real `derivePartnershipSubtype()`
 * (`src/lib/evidence/combination-topology.ts`) returns `VERTICAL`, never `HORIZONTAL` (that
 * requires the SAME line, e.g. two centre-backs).
 *
 * R8-3: this literal is the real, unmodified `deriveCombinationsFromSegments()`'s own output
 * (field-for-field, except `createdAt`) for `combination-source-data.ts`'s canonical positional
 * segment and goal-attribution events, curated down to the Noah+Sindre PARTNERSHIP row this
 * scenario calls out. The full present lineup (minus William, the Guest Player, who is never
 * assigned a position) is positioned for the whole segment in that source module, so the real
 * function also derives lines/triangles/the full-configuration row for the whole squad — this
 * fixture curates to just the one row, matching how `MatchCombinationEvidencePanel` itself
 * already filters a larger derived set down to what it displays. Verified exactly, not
 * approximated: `__tests__/combination-evidence.test.ts` calls the real function against those
 * SAME source records and asserts this literal equals its output byte-for-byte.
 *
 * NOT computed inline here (unlike the test) — `combination-topology.ts` imports the server-only
 * `db` client at module scope; importing any VALUE from that module (not just its types) pulls
 * `db`/`pg`/Node built-ins into this file's own import graph, which breaks the client bundle for
 * `event/after/page.tsx` (`"use client"`) — confirmed by a real CI `Build` failure before this
 * was reverted to a literal. `CombinationEvidenceRow` is imported as a type only, which carries
 * no such risk. `createdAt` is the one field NOT from the derivation — the real function stamps
 * non-deterministic wall-clock `new Date()`, replaced here with the fixed
 * `B06_EVENT_AFTER_REFERENCE_AT` moment.
 */
export const combinationEvidence: CombinationEvidenceRow[] = [
  {
    id: "event-match-gate-b-06-PARTNERSHIP|VERTICAL|participant-gb6e-noah,participant-gb6e-sindre|CF,LCM",
    organisationId: "org-gate-b",
    matchId: null,
    eventMatchId: B06_EVENT_MATCH_ID,
    family: "PARTNERSHIP",
    subtype: "VERTICAL",
    playerIds: ["participant-gb6e-noah", "participant-gb6e-sindre"],
    positions: ["CF", "LCM"],
    minutesTogether: 80,
    goalsForWhilePresent: 3,
    goalsAgainstWhilePresent: 1,
    directGoalContributions: 2,
    directAssistContributions: 0,
    opponentDiversity: 1,
    confidence: "EMERGING",
    approximateTiming: false,
    leagueSeasonId: "season-gate-b-06",
    createdAt: B06_EVENT_AFTER_REFERENCE_AT,
  },
];

export const rawRecordsForHash = {
  matchIdentity,
  report,
  debriefAnswers,
  footballObservations,
  combinationEvidence,
  // R8-3 — the material source records `combinationEvidence` is actually derived from.
  combinationPositionalSegment: b06EventAfterPositionalSegment,
  combinationGoalAttributionEvents: b06EventAfterGoalAttributionEvents,
};
