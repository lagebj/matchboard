import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { EvidenceLineageEntry } from "../shared/evidence-lineage-display";

/**
 * Gate D register D09, superseded-lineage state: a coach's original note was retracted on
 * resubmission (wording softened from an explicit claim to a tentative one), then the active
 * version was recorded. The original statement's wording is preserved verbatim, not rewritten —
 * `recordDeterministicExtraction()`'s real behavior (marks the prior `SUCCEEDED` run
 * `supersededAt`, never deletes or edits it).
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D09-LINEAGE",
  fixtureId: "gate-d-w1-d09-superseded-lineage",
  fixtureVersion: 1,
  fixtureSha256: "dbd5ba618a00479aa3db2d31792e4cab8a129f72794ea0c1ba8dce828bf57632",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-23T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const entries: EvidenceLineageEntry[] = [
  {
    id: "gate-d-w1-d09-obs-1",
    statement: "First touch was inconsistent under pressure in the second half.",
    explicitness: "EXPLICIT",
    createdAt: "2026-11-14T20:00:00.000Z",
    status: "SUPERSEDED",
    supersededAt: "2026-11-14T20:45:00.000Z",
  },
  {
    id: "gate-d-w1-d09-obs-2",
    statement: "First touch seemed a little heavy a couple of times, though it was a wet pitch.",
    explicitness: "TENTATIVE",
    createdAt: "2026-11-14T20:45:00.000Z",
    status: "ACTIVE",
    supersededAt: null,
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D09-LINEAGE", entries };
