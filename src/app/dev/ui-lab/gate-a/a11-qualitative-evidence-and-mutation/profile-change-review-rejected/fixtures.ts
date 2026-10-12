import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { ProfilePrimaryPositionProposal } from "../shared/profile-change-review-card";

/**
 * A11 "guarded profile change review — rejected". Same proposal shape as
 * `profile-change-review-guarded`, proving the reject path leaves the declared primary
 * unchanged and records no silent domain feedback write (`03_INTERACTION_AND_POLICY_CONTRACT.md`-
 * equivalent: "Explicit reject: no change, no implicit domain rejection/feedback write").
 */
export const identity: FixtureIdentity = {
  scenarioId: "A11-profile-change-review-rejected",
  fixtureId: "gate-a-w4-a11-profile-change-review-rejected",
  fixtureVersion: 1,
  fixtureSha256: "b733d80b92892905e46935bfe09677f57ca94f1997bfad512ad6fee6326a3aed",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const PLAYER_NAME = "Sindre";
export const PLAYER_SHIRT_NUMBER = 7;

export const proposal: ProfilePrimaryPositionProposal = {
  playerId: "player-w3-sindre",
  playerName: PLAYER_NAME,
  currentPrimary: "DM",
  proposedPrimary: "CM",
  evidenceRefs: [
    { kind: "ACTUAL_POSITION_INTERVAL", id: "src-actual-lcm-01", label: "LCM, 62 minutes, match-w3-01" },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "src-actual-lcm-02", label: "LCM, 71 minutes, previous round" },
  ],
  materialityNote:
    "Hypothetical fixture threshold, not an approved policy: 2+ matches with 45+ recorded minutes at a central-midfield tactical slot, no contradicting evidence, crosses this UI Lab's illustrative review threshold.",
  limitations: ["Declared primary position has not changed in Matchboard's real records — this is a proposal only."],
};

export const rawRecordsForHash = { proposal };
