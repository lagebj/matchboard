import type { CoverageStatus, FixtureIdentity } from "../shared/coverage";

/**
 * A04-S1 `partial-minutes` fixture (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`): five distinct eligible
 * rounds, each with its own separately recorded **opportunity** fact — eligible denominator five
 * — but no closed actual playing interval for any of them. The measure this fixture can establish
 * is "recorded opportunity", never "played"; it is `NOT_RECORDED`, never a coerced `0`.
 *
 * Independent review round 1 (PR #778, finding R1): eligibility (administratively allowed to
 * play — registration/suspension status) and a recorded opportunity (concretely named to this
 * round's squad) are two different facts. The original fixture only recorded one source per
 * round and described it with eligibility language ("selectable") while counting it as the
 * opportunity fact — the displayed count and its backing source text did not describe the same
 * thing. Each round below now carries both source IDs explicitly, and the counted/displayed fact
 * is the opportunity one specifically.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S1",
  fixtureId: "gate-a-a04-partial-minutes",
  fixtureVersion: 2,
  fixtureSha256: "ae09a5544ebf7064cdcb598556a38322be5689da4caf48315bb56ced206bd725",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const playerId = "player-s1-partial-minutes";
export const groupScopeLabel = "U14 Boys — Group A";

export type EligibleRoundRecord = {
  roundId: string;
  roundLabel: string;
  dateUtc: string;
  /** Proves the player was administratively eligible (registered, not suspended) for this round. */
  eligibilitySourceId: string;
  /**
   * Proves a concrete opportunity was recorded for this round (named to the matchday squad) —
   * `undefined` means eligible but no opportunity was ever recorded, a real and different state
   * from `NOT_RECORDED` minutes. Every round rendered on the page has one; the negative-case
   * fixture below deliberately omits it.
   */
  opportunitySourceId?: string;
};

/** Exactly five distinct eligible rounds, same player and group scope, each with both an
 * eligibility record AND a recorded-opportunity record — the denominator this scenario displays
 * is derived from `eligibleRounds.length`/a real opportunity-presence count, never a hard-coded
 * literal. */
export const eligibleRounds: readonly EligibleRoundRecord[] = [
  { roundId: "round-12", roundLabel: "Round 12", dateUtc: "2026-08-02T10:00:00.000Z", eligibilitySourceId: "src-elig-r12", opportunitySourceId: "src-opp-r12" },
  { roundId: "round-13", roundLabel: "Round 13", dateUtc: "2026-08-09T10:00:00.000Z", eligibilitySourceId: "src-elig-r13", opportunitySourceId: "src-opp-r13" },
  { roundId: "round-14", roundLabel: "Round 14", dateUtc: "2026-08-16T10:00:00.000Z", eligibilitySourceId: "src-elig-r14", opportunitySourceId: "src-opp-r14" },
  { roundId: "round-15", roundLabel: "Round 15", dateUtc: "2026-08-23T10:00:00.000Z", eligibilitySourceId: "src-elig-r15", opportunitySourceId: "src-opp-r15" },
  { roundId: "round-16", roundLabel: "Round 16", dateUtc: "2026-08-30T10:00:00.000Z", eligibilitySourceId: "src-elig-r16", opportunitySourceId: "src-opp-r16" },
];

/** Negative-case fixture, test-only, never rendered on the page: a sixth round where the player
 * was eligible but no opportunity was ever recorded — proves the counting function distinguishes
 * "eligible" from "has a recorded opportunity" rather than conflating the two (review finding R1). */
export const eligibleNoOpportunityRound: EligibleRoundRecord = {
  roundId: "round-17",
  roundLabel: "Round 17",
  dateUtc: "2026-09-06T10:00:00.000Z",
  eligibilitySourceId: "src-elig-r17",
  opportunitySourceId: undefined,
};

/** Negative-case fixture, test-only: a duplicate of `round-12`'s `roundId` with different source
 * IDs — proves the denominator counts distinct rounds, not raw array length, and rejects a
 * mismatched duplicate rather than silently double-counting it (review finding R1). */
export const duplicateRoundIdRecord: EligibleRoundRecord = {
  roundId: "round-12",
  roundLabel: "Round 12 (duplicate)",
  dateUtc: "2026-08-02T10:00:00.000Z",
  eligibilitySourceId: "src-elig-r12-dup",
  opportunitySourceId: "src-opp-r12-dup",
};

/** No actual closed playing interval exists for any of the five rounds above. This fixture
 * deliberately chooses `NOT_RECORDED` (not `UNKNOWN`) — the source can positively state no
 * interval was captured, it is not merely unable to determine expectation. This is a genuinely
 * separate recording scope from the opportunity records above — its own source ID, inspected
 * separately (review finding R3). */
export const actualMinutesMeasure: {
  measureName: "recorded opportunity";
  coverage: CoverageStatus;
  explanation: string;
  minutesSourceId: string;
} = {
  measureName: "recorded opportunity",
  coverage: "NOT_RECORDED",
  explanation:
    "No closed playing interval is recorded for this player in any of these five rounds — only the opportunity records exist. This fixture cannot establish realized participation, so the measure is named 'recorded opportunity', never 'played'.",
  minutesSourceId: "src-minutes-measure-s1",
};

/** The exact raw records `identity.fixtureSha256` is a hash of — tests must recompute the hash
 * from this object, never copy `identity.fixtureSha256` back as the expectation. */
export const rawRecordsForHash = { playerId, groupScopeLabel, eligibleRounds, actualMinutesMeasure };
