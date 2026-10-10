import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_ID, MATCH_W3_NOW_PLANNING_CLOSED, matchW3ClosedIdentity } from "../../shared/match-w3-fixture";

/**
 * A03-S2 `closed-plan-review` (bundle A03-S2): same match, planning closed due to kickoff. Must
 * render as read-only — "Review plan", no editable/active Save/Resolve control, no fabricated
 * exception.
 */
export const reviewSourceId = "src-a03-s2-review";

export const reviewText = `Planning closed when the match kicked off at ${matchW3ClosedIdentity.kickoffTime}. Only a genuine reschedule before the actual start can reopen it.`;

export const rawRecordsForHash = {
  matchId: MATCH_W3_ID,
  lifecycle: matchW3ClosedIdentity.lifecycle,
  reviewText,
};

export const identity: FixtureIdentity = {
  scenarioId: "A03-S2",
  fixtureId: "gate-a-w3-a03-closed-plan-review",
  fixtureVersion: 1,
  fixtureSha256: "6306450c3088e135f4d56e7c53d627ecc8493fe45059a3cc982e44d94085804b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_CLOSED.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};
