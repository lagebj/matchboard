import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3HelperCandidate, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";

/**
 * A09-S6 (`02_SCENARIOS_AND_FIXTURES.md`): the SEPARATE operational `MATCH_DAY_ADDITION` path
 * (ADR-0077/ADR-0151). Didrik's eligibility comes from `matchW3HelperCandidate.helperEligible` —
 * its own eligibility fact, never derived from the planned-selection candidates in
 * `matchW3TodayCandidates`.
 */
export const didrik = matchW3HelperCandidate;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S6",
  fixtureId: "gate-a-w3-a09-match-day-addition",
  fixtureVersion: 1,
  fixtureSha256: "4112974fe87d769bd33bc0704416d5be2f884e293dd73a4b03b653f45763dfc7",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { didrik };
