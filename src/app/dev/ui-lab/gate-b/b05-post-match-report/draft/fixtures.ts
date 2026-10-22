import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b05DraftMatchIdentity, B05_MATCH_ID, B05_OPPONENT_NAME, B05_DRAFT_REFERENCE_AT } from "../../shared/match-b-fixture";
import { b05AfterData, b05InitialReport, b05DebriefAnswers, b05AllPlayers, b05CombinationEvidence, b05FootballObservations, b05TimingReview, b05CanonicalLiveEvents } from "../shared/report-data";
import { b05PositionalSegments, b05GoalAttributionEvents } from "../shared/combination-source-data";

/**
 * B05 "Post-match Report / Draft" (official Gate B register, deferred row — now picked up).
 * fixtureVersion 1 was `APPROVED_GOLDEN` at revision `b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`
 * — that approval is preserved as historical fact in `candidate_manifest.json`'s `priorVersions`,
 * not overwritten. This version has not been approved and does not inherit that approval.
 *
 * fixtureVersion 3 (R8-3 remediation) — `b05CombinationEvidence` (report-data.ts) is now the
 * real `deriveCombinationsFromSegments()`'s own verified output against
 * `shared/combination-source-data.ts`'s canonical positional/goal-attribution records (previously
 * hand-written; the positions array's sort order and id format both changed to the real
 * function's own output — see SOURCE_RECONCILIATION.md). Not computed inline (see
 * `report-data.ts`'s own doc comment for why — importing the derivation function itself pulls
 * the server-only `db` client into this client-bundled fixture); verified byte-for-byte against
 * the real function in `shared/__tests__/combination-evidence.test.ts`. Those source records are
 * now also material to this fixture's own hash (`combinationPositionalSegments`/
 * `combinationGoalAttributionEvents` below).
 *
 * fixtureVersion 4 (R9-1) — the R8-3 positional segment (one continuous 0-80' block) contradicted
 * `b05MinutesByParticipant`'s own pre-existing values (Kasper 68, Elias 22, Noah 83) — a fixture
 * integrity defect, not a production engine defect. Corrected to three real segments over a
 * genuine 90-minute match (two 45' halves, matching `b05TimingReview`'s own real second-half
 * duration); every one of the seven existing minute values is now exactly explained, with none
 * changed (see `combination-source-data.ts`'s own doc comment for the full participation model).
 * `minutesTogether` for the displayed Noah+Sindre row corrected 80 -> 83 as a direct consequence.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B05",
  fixtureId: "gate-b-w2-b05-draft",
  fixtureVersion: 4,
  fixtureSha256: "0af7187d0aeb4fcfbbe9e711c63fe3e3b907db3c3ed236944f499ca5cb0e400f",
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
  // R8-3 — the material source records `combinationEvidence` is actually derived from
  // (`combination-source-data.ts`), not just the derived row itself. Already plain,
  // JSON-serializable shapes (no `Map`), so no explicit entries-spread is needed the way
  // `playerMinutes` above requires.
  combinationPositionalSegments: b05PositionalSegments,
  combinationGoalAttributionEvents: b05GoalAttributionEvents,
  footballObservations: b05FootballObservations,
};
