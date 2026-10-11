/**
 * Shared fixture-identity shape (same contract A04 established in
 * `a04-evidence-grammar/shared/coverage.ts`'s `FixtureIdentity`, reproduced here rather than
 * imported — W2's evidence-grammar vocabulary is a different concept family from W3's
 * save/decision state machine, and the two waves should not develop a hidden coupling just
 * because this one small shape happens to match). Every W3 scenario's `fixtures.ts` exports one
 * of these, with `fixtureSha256` independently recomputed from that scenario's own
 * `rawRecordsForHash` in its test file — never copied back as the expectation.
 */
export type FixtureSourceClass = "SYNTHETIC_LABELED";

export type FixtureIdentity = {
  scenarioId: string;
  fixtureId: string;
  fixtureVersion: number;
  fixtureSha256: string;
  sourceClass: FixtureSourceClass;
  fixedDateTimeUtc: string;
  viewerTimeZone: string;
  locale: string;
};
