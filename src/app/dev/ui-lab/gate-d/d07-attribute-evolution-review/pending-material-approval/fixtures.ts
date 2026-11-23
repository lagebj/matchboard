import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { MaterialApprovalProposal } from "../shared/material-approval-review";

/**
 * Gate D register D07, material-approval state: three prior automatic one-point increases
 * (6→7→8→9, each individually within ADR-0160 §4's per-proposal cap) have accumulated to +3 from
 * the last coach-established baseline of 6 — crossing the ≥2 cumulative-point approval trigger.
 * ADR-0160 §4 is explicit that materiality considers cumulative drift, not only the current
 * proposal's own capped delta, so this state requires explicit coach approval even though no
 * single proposal in the chain exceeded one point.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D07-MATERIAL",
  fixtureId: "gate-d-w1-d07-pending-material-approval",
  fixtureVersion: 1,
  fixtureSha256: "0274d0a223af818241c655630f89ef0f3a0ca1c1a79969aa8947daaeba855567",
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
  proposedValue: 9,
  cumulativeAutomaticDelta: 3,
  matchCount: 9,
  confidence: 0.88,
  evidenceSummary: [
    "+1 point after match vs. Askim IF (3 matches, confidence 0.74)",
    "+1 point after match vs. Mysen IL (3 matches, confidence 0.79)",
    "+1 point after match vs. Trøgstad/Båstad (3 matches, confidence 0.88)",
    "Cumulative change since baseline: +3 points — exceeds the 2-point approval trigger (ADR-0160 §4)",
  ],
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D07-MATERIAL", proposal };
