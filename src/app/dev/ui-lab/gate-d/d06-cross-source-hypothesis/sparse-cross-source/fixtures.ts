import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";

/**
 * Gate D Wave 2 — D06, sparse cross-source evidence. Elin Vik has just moved from midfield
 * towards a defensive role; none of the three evidence families the register expects (trend,
 * observation, position history) are individually sufficient yet, and the gaps are of genuinely
 * different kinds — missing data, an insufficient sample, no contrary evidence either way, and
 * explicit coach uncertainty. The mission brief requires these to stay distinguishable rather
 * than collapsed into one vague "not enough evidence" line; `availableFacts` keeps each as its
 * own labelled fact.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D06-SPARSE",
  fixtureId: "gate-d-w2-d06-sparse-cross-source",
  fixtureVersion: 1,
  fixtureSha256: "f382e701b552f057535f915b7a5331df9a7f3ccd8df9617260f67175375b476f",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const noHypothesisState = {
  coachQuestion: "What does the evidence across sources tell us about Elin's move towards a defensive role?",
  insufficiencySummary:
    "No single source family is individually sufficient yet, and the gaps are not interchangeable: missing position coverage, an insufficient trend sample, no contrary evidence either way, and explicit coach uncertainty.",
  availableFacts: [
    "Missing data: no actual position interval recorded yet for Elin at a defensive role",
    "Insufficient sample: only 2 of 6 eligible matches recorded since the move, too few for a trend",
    "No contrary evidence: nothing on record disputes the move so far",
    "Coach uncertainty, recorded directly: \"too early to tell if this is the right role for her\"",
  ],
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D06-SPARSE", noHypothesisState };
