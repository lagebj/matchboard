import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { PositionProposal } from "../shared/position-proposal-review";

/**
 * Gate D register D08, conflicting-note state (corrected 2026-11-24 — the prior version's note
 * actually supported the proposal instead of conflicting with it, failing to demonstrate a
 * genuine evidence conflict). The evidence engine identifies real-back (`RB`) support overtaking
 * the declared right-wing-back (`RWB`) primary from quantitative match data, but a specific coach
 * observation raises real doubt about whether `RB` is actually the right fit — a recurring
 * defensive concern directly relevant to the proposed role, not a restatement of the same
 * conclusion. ADR-0160 §1 requires the coach to review evidence and confidence before deciding —
 * a conflicting note does not block the proposal from being shown, and the system does not
 * silently resolve the conflict in either direction; it is the coach's own judgment call.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D08-CONFLICT",
  fixtureId: "gate-d-w1-d08-conflicting-note",
  fixtureVersion: 2,
  fixtureSha256: "1cf7c624b7b2900c9223571e15e44b9d31913a3c4366883a6fb900b69d81c4e1",
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
    "Coach observation, 7 Nov: \"Beaten in behind twice defending 1v1 in the right-back channel this match — struggled to track the runner once pulled inside. Worth watching before trusting RB as his best fit.\"",
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D08-CONFLICT", proposal };
