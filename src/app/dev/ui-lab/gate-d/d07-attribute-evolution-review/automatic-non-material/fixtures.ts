import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssessmentChangeEntry } from "../shared/assessment-history-display";

/**
 * Gate D register D07, non-material automatic state: a one-point passing improvement, backed by
 * 4 matches and confidence 0.82 — satisfies every ADR-0160 §4 automatic condition (≤1pt,
 * ≥3 matches, confidence ≥0.7, within 1pt of the coach-established baseline), so it applies
 * automatically and appears here exactly as the real `AssessmentHistoryPanel` already renders an
 * `AUTOMATIC`-source change today — no new capability, no approval gate for this state.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D07-AUTOMATIC",
  fixtureId: "gate-d-w1-d07-automatic-non-material",
  fixtureVersion: 1,
  fixtureSha256: "ef3590cf4626956cd38427440e65d35b9e03c1332af3b44f881404bf43a0f8ed",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const changes: AssessmentChangeEntry[] = [
  {
    id: "gate-d-w1-d07-change-1",
    targetType: "ATTRIBUTE",
    attributeKey: "passing",
    targetDescription: "4 matches, confidence 0.82 — within ADR-0160 §4's automatic bounds",
    beforeValue: 6,
    afterValue: 7,
    source: "AUTOMATIC",
    reason: null,
    confidence: 0.82,
    createdAt: "2026-11-21T18:00:00.000Z",
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D07-AUTOMATIC", changes };
