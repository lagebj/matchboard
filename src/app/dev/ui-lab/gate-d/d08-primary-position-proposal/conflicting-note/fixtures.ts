import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PositionProposal } from "../shared/position-proposal-review";

/**
 * Gate D register D08, conflicting-note state: the evidence engine identifies real-back (`RB`)
 * support overtaking the declared right-wing-back (`RWB`) primary, but a recorded coach
 * observation raises a qualitative concern the deterministic engine cannot see. ADR-0160 §1
 * requires the coach to review evidence and confidence before deciding — a conflicting note does
 * not block the proposal from being shown, it is additional context for the coach's own
 * judgment, never a reason to auto-suppress or auto-apply either way.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D08-CONFLICT",
  fixtureId: "gate-d-w1-d08-conflicting-note",
  fixtureVersion: 1,
  fixtureSha256: "2174a68750e2d0a4ea678074750c5ab9cf8247b7aea007145ccd915fb2587976",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const proposal: PositionProposal = {
  currentPrimaryTactical: "RWB",
  strongestEvidenceTactical: "RB",
  confidence: 0.71,
  evidenceSummary: [
    "5 matches at right-back (RB) over the last 8 weeks",
    "Support margin over current declared primary (RWB) holds across two consecutive evidence snapshots",
    "Confidence is lower than the strong-evidence example — fewer qualifying matches",
  ],
  conflictingNote:
    "Coach observation, 7 Nov: \"Less comfortable overlapping as a wing-back lately — seems to prefer staying tucked in, but that could be match-specific instruction rather than a real preference.\"",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D08-CONFLICT", proposal };
