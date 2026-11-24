import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { MaterialApprovalProposal } from "../shared/material-approval-review";

/**
 * Gate D register D07, material-approval state (corrected 2026-11-24 — the prior version showed
 * three automatic one-point increases, 6→7→8→9, reaching a pending proposal of 9 before
 * requiring approval. That contradicted ADR-0160 §4's own math: cumulative movement from baseline
 * crosses the two-point approval trigger at the *second* step, not the third, so a third
 * automatic step to 9 could never have legitimately happened).
 *
 * Corrected state: baseline 6 (coach-established). One automatic one-point increase legitimately
 * applied (6→7 — within the automatic cap, confidence/match-count eligible). The evidence engine
 * now proposes a further one-point step, 7→8 — individually within the per-proposal cap, but
 * cumulative movement from baseline (6→8 = +2) crosses ADR-0160 §4's two-point approval trigger,
 * so this step requires explicit coach approval rather than applying automatically. 8 is NOT yet
 * applied; 7 remains the real current value until the coach decides.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D07-MATERIAL",
  fixtureId: "gate-d-w1-d07-pending-material-approval",
  fixtureVersion: 2,
  fixtureSha256: "521dca006f2e7371489cf295ef1ff05f3f4b7cdef61c0c57fbd02886ea09dcfe",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const proposal: MaterialApprovalProposal = {
  attributeKey: "positioning",
  attributeLabel: "Positioning",
  baselineValue: 6,
  baselineSource: "COACH_ESTABLISHED",
  currentAppliedValue: 7,
  proposedValue: 8,
  matchCount: 3,
  confidence: 0.79,
  evidenceSummary: [
    "Baseline 6 established by the coach.",
    "+1 point applied automatically after 3 matches (confidence 0.74) — within the automatic cap.",
    "A further +1 point is now proposed after 3 more matches (confidence 0.79).",
    "Cumulative change since baseline if accepted: +2 points — crosses the 2-point approval trigger (ADR-0160 §4).",
  ],
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D07-MATERIAL", proposal };
