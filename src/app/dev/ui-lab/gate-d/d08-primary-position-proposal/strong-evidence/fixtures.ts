import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PositionProposal } from "../shared/position-proposal-review";

/**
 * Gate D register D08, strong-evidence state: the exact recorded evidence is the sided code
 * `RCM` (6 matches at right-centre-midfield, confidence 0.86), but the proposal targets the
 * **profile** role `CM` — never `RCM` — per
 * `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`'s own mandatory verification example #6:
 * "Automated position recommendations never propose LCB or LAM as a player-profile primary,
 * although they may suggest those as specific match lineup slots." No conflicting note here.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D08-STRONG",
  fixtureId: "gate-d-w1-d08-strong-evidence",
  fixtureVersion: 1,
  fixtureSha256: "1db49016ab2dddaa31808bcb9a275dabf6aed1a38be07622fa31bf7f33a13f59",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const proposal: PositionProposal = {
  currentPrimaryTactical: "CDM",
  strongestEvidenceTactical: "RCM",
  confidence: 0.86,
  evidenceSummary: [
    "6 matches at right-centre-midfield (RCM) over the last 10 weeks",
    "Support margin over current declared primary (CDM) exceeds the hysteresis threshold across two consecutive evidence snapshots",
    "No contradictory coach observation on record",
  ],
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D08-STRONG", proposal };
