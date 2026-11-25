import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import { canonicalFullLabel } from "@/domain/positions/canonical-labels";
import { collapseTacticalToProfile } from "@/app/dev/ui-lab/gate-a/shared/profile-position-model";
import type { EvidenceSourceMap } from "../../w2-shared/evidence-source-types";

/**
 * Gate D Wave 2 — D06, source inspection + explicit coach confirmation. Sara Dahl's winger-to-
 * striker conversion is supported by a derived trend, a coach observation, and recorded position
 * intervals — a separate cross-source story from `coherent-synthesis`'s, deliberately, so this
 * scenario's own interaction coverage (expanding each source, then Promote/Dismiss) does not
 * depend on reusing the other scenario's fixture content.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D06-SOURCE-INSPECTION",
  fixtureId: "gate-d-w2-d06-source-inspection-confirmation",
  fixtureVersion: 2,
  fixtureSha256: "292731ae261d3ad8bc3dae5cd4e37bcf82d93514bdcc47fdfeb30ea994fe580a",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

const LW_LABEL = canonicalFullLabel("LW");
const CF_LABEL = canonicalFullLabel("CF");
export const wingProfileRole = collapseTacticalToProfile("LW");
export const forwardProfileRole = collapseTacticalToProfile("CF");

export const hypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d06-source-inspection-hypothesis",
  statement: `Sara Dahl's recorded minutes have shifted from left wing towards centre forward over the latest matches — in 14-role profile terms, from profile role: ${wingProfileRole} to profile role: ${forwardProfileRole} — and a recent coach observation describes improved link-up play in that central role. This reflects her current on-pitch exposure and the coach's own read of it — not a confirmed attribute or position-suitability conclusion. Confirming this would record 'Developing as a central striking option' as an explicit development focus rather than leaving the pattern implicit.`,
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-sara-cf-exposure", label: "Centre forward role minutes, previous 3 vs. latest 3 matches" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-sara-cf-linkup", label: "Coach observation, 11 Oct 2026 vs Grorud" },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "interval-sara-lw-early", label: `Recorded position, 30 Aug 2026 (${LW_LABEL})` },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "interval-sara-cf-recent", label: `Recorded position, 11 Oct 2026 (${CF_LABEL})` },
  ],
  contradictingRefs: [],
  missingEvidence: ["No recorded evidence yet on Sara's hold-up play against physical defenders"],
};

export const sources: EvidenceSourceMap = {
  "trend-sara-cf-exposure": {
    id: "trend-sara-cf-exposure",
    kind: "DERIVED_TREND",
    label: "Centre forward role minutes, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Minutes recorded at centre forward: 15 across the previous 3 matches (30 Aug - 20 Sep) -> 165 across the latest 3 matches (27 Sep - 11 Oct). Based on 6 total eligible matches this window.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "obs-sara-cf-linkup": {
    id: "obs-sara-cf-linkup",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 11 Oct 2026 vs Grorud",
    occurredAt: "11 Oct 2026",
    detail: "Linked up well with the midfield from centre forward tonight — held the ball up twice and brought a teammate into the attack.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "interval-sara-lw-early": {
    id: "interval-sara-lw-early",
    kind: "ACTUAL_POSITION_INTERVAL",
    label: `Recorded position, 30 Aug 2026 (${LW_LABEL})`,
    occurredAt: "30 Aug 2026",
    detail: `Played the full 90 minutes at ${LW_LABEL} (exact tactical code: LW) vs Lillestrøm.`,
    provenance: "RECORDED",
    coverage: "Single match, full-match interval",
  },
  "interval-sara-cf-recent": {
    id: "interval-sara-cf-recent",
    kind: "ACTUAL_POSITION_INTERVAL",
    label: `Recorded position, 11 Oct 2026 (${CF_LABEL})`,
    occurredAt: "11 Oct 2026",
    detail: `Played the full 90 minutes at ${CF_LABEL} (exact tactical code: CF) vs Grorud.`,
    provenance: "RECORDED",
    coverage: "Single match, full-match interval",
  },
};

export const CONFIRM_FOCUS_TEXT = "Developing as a central striking option";

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D06-SOURCE-INSPECTION", hypothesis, sources };
