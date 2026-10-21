import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05CompletedMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_NOW } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview, b05CanonicalLiveEvents } from "../shared/report-data";

/**
 * B05 "Post-match Report / Completed" — the same real match as `draft/`, now locked.
 * fixtureVersion 2 — remediated per B2-R2/R3/R4/R5/R6/R7. See `draft/fixtures.ts`'s own doc
 * comment for the historical-approval preservation note (same applies here).
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05-COMPLETED",
  fixtureId: "gate-b-w2-b05-completed",
  fixtureVersion: 2,
  fixtureSha256: "e1f4b269e0660c8435c7a5c8d575cf97f7463489943c662b9a16bc7b3c1c60d4",
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
  footballObservations: b05FootballObservations,
};
