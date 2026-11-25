import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { RejectedExtractionSubmission } from "../shared/rejected-extraction-display";

/**
 * Gate D register D09, ambiguous-reference state: a coach note uses a pronoun with no
 * identifiable player (no name, no shirt number, no prior sentence establishing who "he" refers
 * to). Per the real `validateExtractionSemantics` rule, a PLAYER-scoped claim with no resolvable
 * `playerRef` rejects the WHOLE extraction response — this submission produces zero observations,
 * never a weak or ambiguous-but-kept one.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D09-AMBIGUOUS",
  fixtureId: "gate-d-w1-d09-ambiguous-reference-rejected",
  fixtureVersion: 1,
  fixtureSha256: "1be0cc32c505baaaf1c09d0a7056d3c1923d357b9cd6d9f8d22b36bfa323aee1",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const submission: RejectedExtractionSubmission = {
  submittedText: "He was really strong in the second half, held the ball up well under pressure.",
  rejectionReason:
    "No player name, shirt number, or prior reference resolves \"he\" to a known player in this submission — the extraction response is discarded entirely rather than attributed to a guess.",
  resultingObservationCount: 0,
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D09-AMBIGUOUS", submission };
