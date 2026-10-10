import type { FixtureIdentity } from "../shared/coverage";

/**
 * A04-S2 `role-exposure-sparse` fixture: six eligible matches/period positions in the denominator,
 * only two with usable actual role-duration evidence. The other four are missing/unrecorded role
 * exposure — never zero role time.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S2",
  fixtureId: "gate-a-a04-role-exposure-sparse",
  fixtureVersion: 1,
  fixtureSha256: "5bf5e004773abb5281372ced6dbd089a4a50627a754c3510bba2c21353bfd4f4",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const playerId = "player-s2-role-exposure-sparse";
export const roleLabel = "CM";
export const groupScopeLabel = "U15 Girls — Group B";

export type EligibleMatchRoleExposure = {
  matchId: string;
  matchLabel: string;
  dateUtc: string;
  coverage: "COMPLETE" | "NOT_RECORDED";
  minutes?: number;
  sourceId: string;
};

/** Six eligible matches, chronologically ordered. Exactly two (`match-02`, `match-05`) carry a
 * real recorded `minutes` value; the other four are `NOT_RECORDED` — never a hidden `minutes: 0`. */
export const eligibleMatches: readonly EligibleMatchRoleExposure[] = [
  { matchId: "match-01", matchLabel: "Match 1", dateUtc: "2026-07-05T10:00:00.000Z", coverage: "NOT_RECORDED", sourceId: "src-role-m01" },
  { matchId: "match-02", matchLabel: "Match 2", dateUtc: "2026-07-12T10:00:00.000Z", coverage: "COMPLETE", minutes: 18, sourceId: "src-role-m02" },
  { matchId: "match-03", matchLabel: "Match 3", dateUtc: "2026-07-19T10:00:00.000Z", coverage: "NOT_RECORDED", sourceId: "src-role-m03" },
  { matchId: "match-04", matchLabel: "Match 4", dateUtc: "2026-07-26T10:00:00.000Z", coverage: "NOT_RECORDED", sourceId: "src-role-m04" },
  { matchId: "match-05", matchLabel: "Match 5", dateUtc: "2026-08-02T10:00:00.000Z", coverage: "COMPLETE", minutes: 24, sourceId: "src-role-m05" },
  { matchId: "match-06", matchLabel: "Match 6", dateUtc: "2026-08-09T10:00:00.000Z", coverage: "NOT_RECORDED", sourceId: "src-role-m06" },
];

export const rawRecordsForHash = { playerId, roleLabel, groupScopeLabel, eligibleMatches };
