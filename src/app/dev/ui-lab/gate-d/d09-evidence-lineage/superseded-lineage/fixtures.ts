import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { EvidenceLineageEntry } from "../shared/evidence-lineage-display";

/**
 * Gate D register D09, superseded-lineage state: a coach's original note was retracted on
 * resubmission (wording softened from an explicit claim to a tentative one), then the active
 * version was recorded. Each entry's extracted `statement` is preserved verbatim across
 * supersession, not rewritten — `recordDeterministicExtraction()`'s real behavior (marks the
 * prior `SUCCEEDED` run `supersededAt`, never deletes or edits it).
 *
 * `fixtureVersion` bumped 1->2 on 2026-11-25 (entry data and `fixtureSha256` unchanged) — the
 * shared `EvidenceLineageDisplay`'s on-page description text was corrected: it previously said
 * "the coach's original wording is preserved," which this schema does not actually establish
 * (only the extracted observation's `statement` is preserved, not necessarily the coach's
 * byte-identical raw submission). The rendered page changed; this fixture's own data did not.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D09-LINEAGE",
  fixtureId: "gate-d-w1-d09-superseded-lineage",
  fixtureVersion: 2,
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
