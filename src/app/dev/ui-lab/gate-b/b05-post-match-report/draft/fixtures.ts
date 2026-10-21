import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05DraftMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_KICKOFF_AT } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview } from "../shared/report-data";

/**
 * B05 "Post-match Report / Draft" (official Gate B register, deferred row — now picked up):
 * "Finish/report actions versus read-only knowledge." This is the editable moment: the real
 * report-completion action (`Complete report`, inside the real `PostMatchReportShell`) is
 * reachable, the real debrief is already submitted (so that action is genuinely unblocked, not a
 * dead button), and the real `GoalAttributionGapBanner`/`RecoveredTimingCallout` show one real
 * unresolved item each — the honest "almost done, two things left" state, not an empty draft.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05",
  fixtureId: "gate-b-w2-b05-draft",
  fixtureVersion: 1,
  fixtureSha256: "3f0fd7f4bcb6782a6077649b87e96154e97adf0f56f93f98fcf63516e947010b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B05_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchId = B05_MATCH_ID;
export const opponentName = B05_OPPONENT_NAME;
export const matchIdentity = b05DraftMatchIdentity;
export const afterData = b05AfterData("draft");
export const initialReport = b05InitialReport("draft");
export const debriefAnswers = b05DebriefAnswers;
export const allPlayers = b05AllPlayers;
export const timingReview = b05TimingReview("draft");

export const rawRecordsForHash = {
  matchIdentity,
  afterData,
  // `afterData.playerMinutes` is a Map — `JSON.stringify` silently serializes a Map as `{}`,
  // which would exclude it from the hash entirely (exactly the B1-R7 class of bug). Spread its
  // entries explicitly so a changed minute actually changes the hash.
  playerMinutesEntries: [...afterData.playerMinutes.entries()],
  initialReport,
  debriefAnswers,
  combinationEvidence: b05CombinationEvidence,
  footballObservations: b05FootballObservations,
};
