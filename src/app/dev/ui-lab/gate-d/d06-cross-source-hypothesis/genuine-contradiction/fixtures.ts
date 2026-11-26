import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import { canonicalFullLabel } from "@/domain/positions/canonical-labels";
import type { EvidenceSourceMap } from "../../w2-shared/evidence-source-types";

/**
 * Gate D Wave 2 — D06, genuine contradictory evidence. An earlier formal coach assessment (20
 * Sep) judged Noah Fjeld not yet ready for centre-back in matches that matter; a more recent
 * observation (11 Oct) describes him as composed enough to trust there now. Both concern the
 * exact same substantive question — his readiness for centre-back — not two compatible
 * statements dressed up as a conflict. Per ADR-0155 §9 ("history is evidence... never reconciled
 * away"), Assistant Coach discloses the disagreement rather than assuming the later note simply
 * supersedes the earlier assessment; a trend and a position interval provide supporting context,
 * but neither resolves the conflict between the two coach-sourced judgments.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D06-CONTRADICTION",
  fixtureId: "gate-d-w2-d06-genuine-contradiction",
  fixtureVersion: 1,
  fixtureSha256: "2d878b8554472976eaa723060640cbb020c6cee00bdab90606318ee3d63673a5",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

const LCB_LABEL = canonicalFullLabel("LCB");

export const hypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d06-contradiction-hypothesis",
  statement:
    "An earlier formal assessment (20 Sep) judged Noah Fjeld not yet ready for centre-back in matches that matter. A more recent observation (11 Oct), in a window where his recorded centre-back minutes have increased, describes him as composed enough to trust there now. These two coach-sourced judgments disagree about the same question — his readiness for centre-back — and Assistant Coach does not assume the later note simply supersedes the earlier assessment; only the coach can confirm which stands.",
  uncertainty: "HIGH",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-noah-cb-exposure-2", label: "Centre-back role minutes, previous 3 vs. latest 3 matches" },
    { kind: "ACTUAL_POSITION_INTERVAL", id: "interval-noah-cb-recent-2", label: `Recorded position, 11 Oct 2026 (${LCB_LABEL})` },
  ],
  contradictingRefs: [
    { kind: "HUMAN_ASSESSMENT", id: "assessment-noah-cb-not-ready", label: "Coach assessment, 20 Sep 2026" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-noah-cb-trusted-now", label: "Coach observation, 11 Oct 2026 vs Grorud" },
  ],
  missingEvidence: ["No updated formal assessment yet confirming whether the 20 Sep judgment should be revised"],
};

export const sources: EvidenceSourceMap = {
  "trend-noah-cb-exposure-2": {
    id: "trend-noah-cb-exposure-2",
    kind: "DERIVED_TREND",
    label: "Centre-back role minutes, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Minutes recorded at centre-back: 0 across the previous 3 matches (30 Aug - 20 Sep) -> 180 across the latest 3 matches (27 Sep - 11 Oct). Based on 6 total eligible matches this window.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "interval-noah-cb-recent-2": {
    id: "interval-noah-cb-recent-2",
    kind: "ACTUAL_POSITION_INTERVAL",
    label: `Recorded position, 11 Oct 2026 (${LCB_LABEL})`,
    occurredAt: "11 Oct 2026",
    detail: `Played the full 90 minutes at ${LCB_LABEL} (exact tactical code: LCB) vs Grorud.`,
    provenance: "RECORDED",
    coverage: "Single match, full-match interval",
  },
  "assessment-noah-cb-not-ready": {
    id: "assessment-noah-cb-not-ready",
    kind: "HUMAN_ASSESSMENT",
    label: "Coach assessment, 20 Sep 2026",
    occurredAt: "20 Sep 2026",
    detail: "Not ready for centre-back yet — needs another full season at right-back before being trusted there in matches that matter.",
    provenance: "RECORDED",
    coverage: "One formal coach-authored assessment, not yet revised",
  },
  "obs-noah-cb-trusted-now": {
    id: "obs-noah-cb-trusted-now",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 11 Oct 2026 vs Grorud",
    occurredAt: "11 Oct 2026",
    detail: "Properly composed at centre-back tonight — I'd trust him there in a close match now.",
    provenance: "RECORDED",
    coverage: "Single match observation, three weeks after the contradicting assessment",
  },
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D06-CONTRADICTION", hypothesis, sources };
