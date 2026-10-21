import type { FixtureIdentity } from "../../../../gate-a/shared/fixture-identity";
import { b06LeagueAfterIdentity, b06LeagueAfterTimeline, B06_LEAGUE_OPPONENT_NAME, B06_LEAGUE_AFTER_REFERENCE_AT } from "../../../shared/match-b-fixture";

/**
 * B06 League · After — the SAME match as `league/before` (same `B06_LEAGUE_MATCH_ID`/identity/
 * kickoff/orientation), now `done` with a recorded 3-1 result — League's own before/after
 * lifecycle continuity (XR-S01), matching B01's established pattern. Read-only: the real AFTER
 * Overview has no mutation entry point. fixtureVersion 2 — B3-R4 remediation: the reference time
 * is now after the final whistle, never kickoff itself.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B06-LEAGUE-AFTER",
  fixtureId: "gate-b-w3-b06-league-after",
  fixtureVersion: 2,
  fixtureSha256: "920a2dd12febea4c02693a248e7e009e52e6ee28ed0c7c82468f3a34207ed332",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B06_LEAGUE_AFTER_REFERENCE_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b06LeagueAfterIdentity;
export const timeline = b06LeagueAfterTimeline;
export const opponentName = B06_LEAGUE_OPPONENT_NAME;

export const rawRecordsForHash = { matchIdentity, timeline };
