import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05CompletedMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_KICKOFF_AT } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview } from "../shared/report-data";

/**
 * B05 "Post-match Report / Completed" (official Gate B register, deferred row — now picked up):
 * the same real match as `draft/`, now locked. Read-only: no draft mutation control is visible
 * (`PostMatchReportShell` renders neither "Complete report" nor any add/remove/edit control once
 * `status === "LOCKED"`), the previously-unattributed goal is now attributed, and the timing
 * review item is resolved — the same real unresolved items from the draft, now genuinely cleared,
 * not silently dropped.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05-COMPLETED",
  fixtureId: "gate-b-w2-b05-completed",
  fixtureVersion: 1,
  fixtureSha256: "99d00c34ab0d98b4fd88178946a0cbc1a7fb3dbb75965847d66d7666ff21678c",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B05_KICKOFF_AT.toISOString(),
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
  combinationEvidence: b05CombinationEvidence,
  footballObservations: b05FootballObservations,
};
