import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_ID, MATCH_W3_NOW_PLANNING_OPEN, matchW3Identity } from "../../shared/match-w3-fixture";

/**
 * A03-S3 `permission-denied` (bundle A03-S3): actor lacks permission/group access. Display the
 * permission-denied reason, no mutating action, same object context — but do NOT reveal squad or
 * slot detail the actor would not see in production. This fixture deliberately does not import
 * `matchW3Squad`/`MATCH_W3_PENDING_STARTER_PLAYER_ID`/`MATCH_W3_UNFILLED_SLOT` at all — only the
 * minimal match identity (id/teams/kickoff, via the shared `matchW3Identity`) a denied actor is
 * still told exists.
 */
export const deniedReasonSourceId = "src-a03-s3-denied";
export const deniedReasonText = "You do not have access to this team's planning group.";

export const minimalMatchTeamName = matchW3Identity.homeTeam;
export const minimalMatchOpponentName = matchW3Identity.awayTeam;

export const rawRecordsForHash = {
  matchId: MATCH_W3_ID,
  deniedReasonText,
};

export const identity: FixtureIdentity = {
  scenarioId: "A03-S3",
  fixtureId: "gate-a-w3-a03-permission-denied",
  fixtureVersion: 1,
  fixtureSha256: "adbcdd471bb8c17e06d90b38377de484fe5959fe21fd188b5420e24ad6ec00cd",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};
