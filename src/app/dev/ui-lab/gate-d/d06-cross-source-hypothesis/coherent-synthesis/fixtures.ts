import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import { canonicalFullLabel } from "@/domain/positions/canonical-labels";
import { collapseTacticalToProfile } from "@/app/dev/ui-lab/gate-a/shared/profile-position-model";
import type { EvidenceSourceMap } from "../../w2-shared/evidence-source-types";

/**
 * Gate D Wave 2 — D06, coherent cross-source synthesis (register D06: "Trend + coach observation
 * + position history vs sparse data"). Noah Fjeld's on-pitch exposure has genuinely shifted from
 * right-back to centre-back; a derived trend, a coach observation, and his actual recorded
 * position intervals all point the same way without being merged into one measurement. The
 * exact position-interval evidence keeps its 24-code precision (RB/LCB); only the hypothesis's
 * own narrative language uses the 14-role profile projection (`collapseTacticalToProfile`,
 * ADR-0160 §6) — reused, never re-derived.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D06-COHERENT",
  fixtureId: "gate-d-w2-d06-coherent-synthesis",
  fixtureVersion: 2,
  fixtureSha256: "4286f363a6397e08fc92eca38f6379b2543c28345d0a3ffb1f649d95dde51fed",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

const RB_LABEL = canonicalFullLabel("RB");
const LCB_LABEL = canonicalFullLabel("LCB");
export const rbProfileRole = collapseTacticalToProfile("RB");
export const cbProfileRole = collapseTacticalToProfile("LCB");

export const hypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d06-coherent-hypothesis",
  statement: `Noah Fjeld's on-pitch exposure has shifted from right-back towards centre-back over the latest matches — in 14-role profile terms, from profile role: ${rbProfileRole} to profile role: ${cbProfileRole}. This shift is consistent with both his recorded position intervals and a recent coach observation about his central defending. It reflects a change in role exposure, not a demonstrated improvement in centre-back ability — no attribute or position-suitability conclusion is implied.`,
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-noah-cb-exposure", label: "Centre-back role minutes, previous 3 vs. latest 3 matches" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-noah-cb-comfort", label: "Coach observation, 11 Oct 2026 vs Grorud" },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "interval-noah-rb-early", label: `Recorded position, 30 Aug 2026 (${RB_LABEL})` },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "interval-noah-cb-recent", label: `Recorded position, 11 Oct 2026 (${LCB_LABEL})` },
  ],
  contradictingRefs: [],
  missingEvidence: ["No recorded evidence yet on positioning in transition (out-of-possession shape)"],
};

export const sources: EvidenceSourceMap = {
  "trend-noah-cb-exposure": {
    id: "trend-noah-cb-exposure",
    kind: "DERIVED_TREND",
    label: "Centre-back role minutes, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Minutes recorded at centre-back: 0 across the previous 3 matches (30 Aug - 20 Sep) -> 180 across the latest 3 matches (27 Sep - 11 Oct), out of 270 total recorded minutes in that window. Based on 6 total eligible matches this window.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "obs-noah-cb-comfort": {
    id: "obs-noah-cb-comfort",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 11 Oct 2026 vs Grorud",
    occurredAt: "11 Oct 2026",
    detail: "Looked comfortable in aerial duels at centre-back tonight, and organised the back line well for a player still new to the position.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "interval-noah-rb-early": {
    id: "interval-noah-rb-early",
    kind: "ACTUAL_POSITION_INTERVAL",
    label: `Recorded position, 30 Aug 2026 (${RB_LABEL})`,
    occurredAt: "30 Aug 2026",
    detail: `Played the full 90 minutes at ${RB_LABEL} (exact tactical code: RB) vs Lillestrøm.`,
    provenance: "RECORDED",
    coverage: "Single match, full-match interval",
  },
  "interval-noah-cb-recent": {
    id: "interval-noah-cb-recent",
    kind: "ACTUAL_POSITION_INTERVAL",
    label: `Recorded position, 11 Oct 2026 (${LCB_LABEL})`,
    occurredAt: "11 Oct 2026",
    detail: `Played the full 90 minutes at ${LCB_LABEL} (exact tactical code: LCB) vs Grorud.`,
    provenance: "RECORDED",
    coverage: "Single match, full-match interval",
  },
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D06-COHERENT", hypothesis, sources };
