import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05DraftMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_DRAFT_REFERENCE_AT } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview, b05CanonicalLiveEvents } from "../shared/report-data";

/**
 * B05 "Post-match Report / Draft" (official Gate B register, deferred row — now picked up).
 * fixtureVersion 2 — remediated per B2-R2/R3/R4/R5/R6/R7 (see
 * `docs/ui-lab/gate-b-w2-candidates/BLOCKERS.md`). fixtureVersion 1 was `APPROVED_GOLDEN` at
 * revision `b9a95c9dbf4289a2727a15bd73375a4dc6381e2e` — that approval is preserved as historical
 * fact in `candidate_manifest.json`'s `priorVersions`, not overwritten. This version has not
 * been approved and does not inherit that approval.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05",
  fixtureId: "gate-b-w2-b05-draft",
  fixtureVersion: 2,
  fixtureSha256: "3f19b14ae890329a97ee423cd5e73d472098213693b59d15f1dfbe8f8c2423ae",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B05_DRAFT_REFERENCE_AT.toISOString(),
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
  canonicalLiveEvents: b05CanonicalLiveEvents,
  combinationEvidence: b05CombinationEvidence,
  footballObservations: b05FootballObservations,
};
