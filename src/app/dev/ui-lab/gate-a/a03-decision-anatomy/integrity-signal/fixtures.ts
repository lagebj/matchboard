import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_ID, MATCH_W3_ROUND_ID, MATCH_W3_ROUND_LABEL, MATCH_W3_NOW_PLANNING_OPEN, MATCH_W3_UNFILLED_SLOT } from "../../shared/match-w3-fixture";

/**
 * A03-S4 `integrity-signal` (bundle A03-S4): a Round Board plan-integrity signal with the same
 * match/scope. Points back to the match/round as a source/reason — never a second fairness/
 * eligibility resolver (no "Resolve" action anywhere on this page).
 */
export const signalSourceId = "src-a03-s4-signal";
export const signalText = `${MATCH_W3_ROUND_LABEL} has one match with an unfilled tactical slot.`;
export const signalReasonText = `${MATCH_W3_UNFILLED_SLOT} remains unfilled on the planning pitch for this match.`;

export const rawRecordsForHash = {
  matchId: MATCH_W3_ID,
  roundId: MATCH_W3_ROUND_ID,
  unfilledSlot: MATCH_W3_UNFILLED_SLOT,
  signalText,
  signalReasonText,
};

export const identity: FixtureIdentity = {
  scenarioId: "A03-S4",
  fixtureId: "gate-a-w3-a03-integrity-signal",
  fixtureVersion: 1,
  fixtureSha256: "e4354de59b7e08d438e27b9e4e1244822fcf822832843e1eaba716930d9f3bf7",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};
