import type { FixtureIdentity } from "../shared/coverage";

/**
 * A04-S3 `role-exposure-supported` fixture: six distinct eligible matches, chronologically
 * ordered, every one with actual recorded CM-profile exposure using the same role definition,
 * time unit, and coverage standard. Minutes `[10, 12, 15, 20, 22, 25]` per
 * `02_A04_SCOPE_AND_FIXTURE_TRUTH.md` — totals must be derived from these intervals, not copied.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S3",
  fixtureId: "gate-a-a04-role-exposure-supported",
  fixtureVersion: 1,
  fixtureSha256: "1350642e7e3e0ce3d0259cd2e4488fc5832947420cae6638723537211c20cbe1",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const playerId = "player-s3-role-exposure-supported";
export const roleLabel = "CM";
export const groupScopeLabel = "U16 Boys — Group A";

export type CompleteMatchRoleExposure = {
  matchId: string;
  matchLabel: string;
  dateUtc: string;
  minutes: number;
  sourceId: string;
};

/** Six distinct eligible matches, ordered chronologically by `dateUtc`. */
export const eligibleMatches: readonly CompleteMatchRoleExposure[] = [
  { matchId: "match-21", matchLabel: "Match 21", dateUtc: "2026-06-07T10:00:00.000Z", minutes: 10, sourceId: "src-cm-m21" },
  { matchId: "match-22", matchLabel: "Match 22", dateUtc: "2026-06-14T10:00:00.000Z", minutes: 12, sourceId: "src-cm-m22" },
  { matchId: "match-23", matchLabel: "Match 23", dateUtc: "2026-06-21T10:00:00.000Z", minutes: 15, sourceId: "src-cm-m23" },
  { matchId: "match-24", matchLabel: "Match 24", dateUtc: "2026-06-28T10:00:00.000Z", minutes: 20, sourceId: "src-cm-m24" },
  { matchId: "match-25", matchLabel: "Match 25", dateUtc: "2026-07-05T10:00:00.000Z", minutes: 22, sourceId: "src-cm-m25" },
  { matchId: "match-26", matchLabel: "Match 26", dateUtc: "2026-07-12T10:00:00.000Z", minutes: 25, sourceId: "src-cm-m26" },
];

export const rawRecordsForHash = { playerId, roleLabel, groupScopeLabel, eligibleMatches };
