import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b01AfterMatchIdentity, b01AfterTimeline, B01_OPPONENT_NAME, B01_KICKOFF_AT } from "../../shared/match-b-fixture";

/**
 * B01 AFTER state (independent review remediation, B1-R4): the SAME match as
 * `b01-planned-ready` (same `B01_MATCH_ID`/identity/kickoff/orientation), now `done` with a
 * recorded result — demonstrates the register-required before/after lifecycle continuity
 * (XR-S01/XR-V01) within one fixture family, not three unrelated matches. Read-only: no
 * mutation entry point, matching the real completed-match Overview.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B01-AFTER",
  fixtureId: "gate-b-w1-b01-after",
  fixtureVersion: 1,
  fixtureSha256: "0484874cb1ac6a28eca1078596eea55ab3812be6e1da9f24d2098f4886a9146a",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B01_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b01AfterMatchIdentity;
export const timeline = b01AfterTimeline;
export const opponentName = B01_OPPONENT_NAME;

export const rawRecordsForHash = { matchIdentity, timeline };
