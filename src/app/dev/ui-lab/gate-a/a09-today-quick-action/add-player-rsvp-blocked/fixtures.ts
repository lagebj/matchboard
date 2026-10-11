import type { FixtureIdentity } from "../../shared/fixture-identity";
import { matchW3TodayCandidates, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_RSVP_CUTOFF_AT } from "../../shared/match-w3-fixture";

/**
 * A09-S3 (`02_SCENARIOS_AND_FIXTURES.md`): RSVP deadline passed, no response. Jonas is blocked as
 * a **planned-selection** candidate only — no bypass/late join is implied, and a separate
 * match-day-addition path (A09-S6) is disclosed in text, never offered as a control here.
 */
export const jonas = matchW3TodayCandidates.jonas;

export const identity: FixtureIdentity = {
  scenarioId: "A09-S3",
  fixtureId: "gate-a-w3-a09-add-player-rsvp-blocked",
  fixtureVersion: 1,
  fixtureSha256: "9565b3ca6e84e3d654d943a99167360c05d54a39e44a285752bb24a78a15867b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rawRecordsForHash = { jonas, rsvpCutoffAt: MATCH_W3_RSVP_CUTOFF_AT.toISOString() };
