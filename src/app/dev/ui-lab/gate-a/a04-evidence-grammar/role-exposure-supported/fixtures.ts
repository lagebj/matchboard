import type { CoverageStatus, FixtureIdentity } from "../shared/coverage";

/**
 * A04-S3 `role-exposure-supported` fixture: six distinct eligible matches, chronologically
 * ordered, every one with actual recorded CM-profile exposure using the same role definition,
 * time unit, and coverage standard. Minutes `[10, 12, 15, 20, 22, 25]` per
 * `02_A04_SCOPE_AND_FIXTURE_TRUTH.md` — totals must be derived from these intervals, not copied.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S3",
  fixtureId: "gate-a-a04-role-exposure-supported",
  fixtureVersion: 2,
  fixtureSha256: "7ff8b53642f04c6d3791f5ee8c0e6f34dcd39f956d4f3a24b7b5002804e6db68",
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
  /** Explicit typed coverage per observation — the comparison function validates every entry is
   * `COMPLETE` with a defined `minutes` value rather than inferring completeness from the mere
   * presence of a `minutes` field (independent review round 1, PR #778, verification gap). */
  coverage: CoverageStatus;
  sourceId: string;
};

/** Six distinct eligible matches, ordered chronologically by `dateUtc`, every one `COMPLETE`. */
export const eligibleMatches: readonly CompleteMatchRoleExposure[] = [
  { matchId: "match-21", matchLabel: "Match 21", dateUtc: "2026-06-07T10:00:00.000Z", minutes: 10, coverage: "COMPLETE", sourceId: "src-cm-m21" },
  { matchId: "match-22", matchLabel: "Match 22", dateUtc: "2026-06-14T10:00:00.000Z", minutes: 12, coverage: "COMPLETE", sourceId: "src-cm-m22" },
  { matchId: "match-23", matchLabel: "Match 23", dateUtc: "2026-06-21T10:00:00.000Z", minutes: 15, coverage: "COMPLETE", sourceId: "src-cm-m23" },
  { matchId: "match-24", matchLabel: "Match 24", dateUtc: "2026-06-28T10:00:00.000Z", minutes: 20, coverage: "COMPLETE", sourceId: "src-cm-m24" },
  { matchId: "match-25", matchLabel: "Match 25", dateUtc: "2026-07-05T10:00:00.000Z", minutes: 22, coverage: "COMPLETE", sourceId: "src-cm-m25" },
  { matchId: "match-26", matchLabel: "Match 26", dateUtc: "2026-07-12T10:00:00.000Z", minutes: 25, coverage: "COMPLETE", sourceId: "src-cm-m26" },
];

/** Negative-case fixture, test-only, never rendered on the page: one of the six matches is
 * actually `NOT_RECORDED` — proves `computeWindowComparison` rejects an incomplete sample instead
 * of silently treating a missing observation as if it were a verified measurement. */
export const eligibleMatchesWithOneIncomplete: readonly CompleteMatchRoleExposure[] = eligibleMatches.map((m, i) =>
  i === 2 ? { ...m, coverage: "NOT_RECORDED" as CoverageStatus, minutes: 0 } : m,
);

/** Negative-case fixture, test-only: a duplicated `matchId` — proves the six-match denominator
 * counts distinct matches, not raw array length. */
export const eligibleMatchesWithDuplicateMatchId: readonly CompleteMatchRoleExposure[] = [
  ...eligibleMatches,
  { ...eligibleMatches[0], sourceId: "src-cm-m21-dup" },
];

export const rawRecordsForHash = { playerId, roleLabel, groupScopeLabel, eligibleMatches };
