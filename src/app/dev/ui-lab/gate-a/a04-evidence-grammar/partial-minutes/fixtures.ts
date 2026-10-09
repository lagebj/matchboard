import type { CoverageStatus, FixtureIdentity } from "../shared/coverage";

/**
 * A04-S1 `partial-minutes` fixture (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`): five distinct eligible
 * rounds, each with a valid opportunity record — eligible denominator five — but no closed actual
 * playing interval for any of them. The measure this fixture can establish is "recorded
 * opportunity", never "played"; it is NOT_RECORDED, never a coerced `0`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A04-S1",
  fixtureId: "gate-a-a04-partial-minutes",
  fixtureVersion: 1,
  fixtureSha256: "56daccceff4c1285e86d4008db0ab1eddb6c9ab811170692e8159ed4f0a170c9",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-09-01T10:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const playerId = "player-s1-partial-minutes";
export const groupScopeLabel = "U14 Boys — Group A";

export type EligibleRoundOpportunity = {
  roundId: string;
  roundLabel: string;
  dateUtc: string;
  opportunitySourceId: string;
};

/** Exactly five distinct eligible rounds, same player and group scope — the eligibility
 * denominator this scenario must display is `eligibleRounds.length`, never a hard-coded 5. */
export const eligibleRounds: readonly EligibleRoundOpportunity[] = [
  { roundId: "round-12", roundLabel: "Round 12", dateUtc: "2026-08-02T10:00:00.000Z", opportunitySourceId: "src-opp-r12" },
  { roundId: "round-13", roundLabel: "Round 13", dateUtc: "2026-08-09T10:00:00.000Z", opportunitySourceId: "src-opp-r13" },
  { roundId: "round-14", roundLabel: "Round 14", dateUtc: "2026-08-16T10:00:00.000Z", opportunitySourceId: "src-opp-r14" },
  { roundId: "round-15", roundLabel: "Round 15", dateUtc: "2026-08-23T10:00:00.000Z", opportunitySourceId: "src-opp-r15" },
  { roundId: "round-16", roundLabel: "Round 16", dateUtc: "2026-08-30T10:00:00.000Z", opportunitySourceId: "src-opp-r16" },
];

/** No actual closed playing interval exists for any of the five rounds above. This fixture
 * deliberately chooses `NOT_RECORDED` (not `UNKNOWN`) — the source can positively state no
 * interval was captured, it is not merely unable to determine expectation. */
export const actualMinutesMeasure: {
  measureName: "recorded opportunity";
  coverage: CoverageStatus;
  explanation: string;
  minutesSourceId: string;
} = {
  measureName: "recorded opportunity",
  coverage: "NOT_RECORDED",
  explanation:
    "No closed playing interval is recorded for this player in any of these five rounds — only the planned-opportunity record exists. This fixture cannot establish realized participation, so the measure is named 'recorded opportunity', never 'played'.",
  minutesSourceId: "src-minutes-measure-s1",
};

/** The exact raw records `identity.fixtureSha256` is a hash of — tests must recompute the hash
 * from this object, never copy `identity.fixtureSha256` back as the expectation. */
export const rawRecordsForHash = { playerId, groupScopeLabel, eligibleRounds, actualMinutesMeasure };
