import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_UNFILLED_SLOT, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { ProposalBlockedReason } from "../shared/lineup-proposal-editor";

/**
 * A10 "disabled/failure" — register row 37's third named case. No proposal is generated at all
 * (Assistant Coach off, or the most recent attempt failed) — matches A10's own "Cannot propose"
 * minimum visual state: a reason renders, never an executable-looking Apply.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A10-disabled-or-failed",
  fixtureId: "gate-a-w4-a10-disabled-or-failed",
  fixtureVersion: 1,
  fixtureSha256: "6d79e32484c6069ec8a623360c2595f0c4aa5473ee5eba28b62f521e9c820af9",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;

export const blockedReason: ProposalBlockedReason = {
  kind: "UNAVAILABLE",
  message: "Assistant Coach is currently unavailable, so no automated lineup suggestion was generated for this slot.",
};

export const rawRecordsForHash = { slotLabel, blockedReason };
