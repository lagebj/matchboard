import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05CompletedMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_NOW } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview, b05CanonicalLiveEvents, B05_MATCH_FORMAT } from "../shared/report-data";
import { b05PositionalSegments, b05GoalAttributionEvents, b05RotationEvents } from "../shared/combination-source-data";

/**
 * B05 "Post-match Report / Completed" — the same real match as `draft/`, now locked.
 * See `draft/fixtures.ts`'s own doc comment for the historical-approval preservation note, the
 * fixtureVersion 3 (R8-3) real-derivation note, the fixtureVersion 4 (R9-1) participation
 * correction note, the fixtureVersion 5 (R10-1) match-format/chronology correction note, and the
 * fixtureVersion 6 (R11-1/R11-2/R11-3) validation/narrative/hash-provenance correction note — all
 * apply identically to this fixture's own `combinationEvidence`/debrief/narrative.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05-COMPLETED",
  fixtureId: "gate-b-w2-b05-completed",
  fixtureVersion: 6,
  fixtureSha256: "996ccbf309479d527108beb7b9775500b07791708d46187b4754fd7d2a22a093",
  sourceClass: "SYNTHETIC_LABELED",
  // B2-R7: an observation time after `B05_COMPLETED_AT` (12:05), not kickoff — `B05_NOW` is 11
  // days later, a plausible "coach looking back at a completed report" moment.
  fixedDateTimeUtc: B05_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchId = B05_MATCH_ID;
export const opponentName = B05_OPPONENT_NAME;
export const matchIdentity = b05CompletedMatchIdentity;
export const afterData = b05AfterData("completed");
export const initialReport = b05InitialReport("completed");
export const debriefAnswers = b05DebriefAnswers;
export const allPlayers = b05AllPlayers;
export const timingReview = b05TimingReview("completed");

export const rawRecordsForHash = {
  matchIdentity,
  afterData,
  playerMinutesEntries: [...afterData.playerMinutes.entries()],
  initialReport,
  debriefAnswers,
  canonicalLiveEvents: b05CanonicalLiveEvents,
  combinationEvidence: b05CombinationEvidence,
  // R8-3 — the material source records `combinationEvidence` is actually derived from.
  combinationPositionalSegments: b05PositionalSegments,
  combinationGoalAttributionEvents: b05GoalAttributionEvents,
  // R11-3: both the declared match format and the (explicitly empty) rotation-event record are
  // material to this scenario's own provenance — a future change to either must change this
  // fixture's hash, not silently disappear from it.
  matchFormat: B05_MATCH_FORMAT,
  rotationEvents: b05RotationEvents,
  footballObservations: b05FootballObservations,
};
