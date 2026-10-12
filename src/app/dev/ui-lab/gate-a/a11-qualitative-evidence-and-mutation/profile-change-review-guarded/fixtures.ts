import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { ProfilePrimaryPositionProposal } from "../shared/profile-change-review-card";

/**
 * A11 "guarded profile change review" (register row 38 + `04_ASSISTANT_COACH_AND_PLAYER_
 * MUTATIONS.md` "Candidate UI Lab states"). Reuses W3's `player-w3-sindre` identity (the LCM
 * starter in `match-w3-fixture.ts`) rather than inventing a new player — his real W3 story (LCM
 * tactical minutes) is exactly the "sided tactical observation contributing to an unsided CM
 * profile role" case `04`'s position-domain refinement section describes. The materiality
 * threshold below is an explicit, disclosed HYPOTHETICAL fixture value, never a claim that any
 * real policy has been approved — see `docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md` W4-BLK-09.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A11-profile-change-review-guarded",
  fixtureId: "gate-a-w4-a11-profile-change-review-guarded",
  fixtureVersion: 1,
  fixtureSha256: "ede930e16e8fe10079183ba4e001dd89dae9b4ff347f8177bdcd74f5da08068f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const PLAYER_ID = "player-w3-sindre";
export const PLAYER_NAME = "Sindre";
export const PLAYER_SHIRT_NUMBER = 7;

export const proposal: ProfilePrimaryPositionProposal = {
  playerId: PLAYER_ID,
  playerName: PLAYER_NAME,
  currentPrimary: "DM",
  proposedPrimary: "CM",
  evidenceRefs: [
    { kind: "ACTUAL_POSITION_INTERVAL", id: "src-actual-lcm-01", label: "LCM, 62 minutes, match-w3-01" },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "src-actual-lcm-02", label: "LCM, 71 minutes, previous round" },
    { kind: "QUALITATIVE_OBSERVATION", id: "src-obs-composure-sindre", label: "coach observation, 2026-10-03" },
  ],
  materialityNote:
    "Hypothetical fixture threshold, not an approved policy: 2+ matches with 45+ recorded minutes at a central-midfield tactical slot, no contradicting evidence, crosses this UI Lab's illustrative review threshold.",
  limitations: ["Declared primary position has not changed in Matchboard's real records — this is a proposal only."],
};

export const rawRecordsForHash = { proposal };
