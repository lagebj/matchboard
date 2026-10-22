import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05CompletedMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_NOW } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview, b05CanonicalLiveEvents } from "../shared/report-data";
import { b05PositionalSegments, b05GoalAttributionEvents } from "../shared/combination-source-data";

/**
 * B05 "Post-match Report / Completed" — the same real match as `draft/`, now locked.
 * See `draft/fixtures.ts`'s own doc comment for the historical-approval preservation note, the
 * fixtureVersion 3 (R8-3) real-derivation note, and the fixtureVersion 4 (R9-1) participation
 * correction note — all apply identically to this fixture's own `combinationEvidence`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05-COMPLETED",
  fixtureId: "gate-b-w2-b05-completed",
  fixtureVersion: 4,
  fixtureSha256: "784499a4fef110330cde5f7a7aa8a04b29dfa10655915893e7ba2d4d894bd34f",
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
  footballObservations: b05FootballObservations,
};
