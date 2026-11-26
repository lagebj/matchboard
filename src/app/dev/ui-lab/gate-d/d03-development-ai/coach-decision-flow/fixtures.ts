import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import type { EvidenceSourceMap } from "../../w2-shared/evidence-source-types";

/**
 * Gate D Wave 2 — D03, coach decision flow. Three hypotheses, each demonstrating one branch of
 * the real `AssistantCoachHypothesisPanel` interaction (mission §6/§11): a successful simulated
 * Promote, a successful simulated Dismiss, and a simulated Promote failure. All three stay
 * pending until the coach acts — nothing here is pre-decided.
 *
 * Remediation (owner review of PR #847, finding P1 #1): the original version of this fixture
 * cited evidence identifiers (`trend-amir-lm-minutes`, `obs-amir-lm-comfort`,
 * `trend-amir-trailing-rate`, `trend-amir-copresence`) with no backing `EvidenceSourceMap` — the
 * interaction tests passed, but nothing had verified the cited evidence actually existed. Every
 * cited ref below now resolves to a real fixture source record with an explicit comparison
 * window, units, and coverage; `confirmHypothesis`'s "two recent observations" claim is backed by
 * two actual observation records, not one (the original fixture claimed two but cited only one —
 * corrected here by adding the second, genuinely distinct observation rather than weakening the
 * wording).
 *
 * Remediation (owner review of PR #847, finding P2 — unsupported teammate comparison):
 * `dismissHypothesis`'s statement previously claimed "several teammates show the same pattern",
 * but `trend-amir-trailing-rate` contains only Amir's own measurements, and this same hypothesis's
 * own `missingEvidence` already disclosed "No comparison against squad-wide trailing-rate baseline
 * yet" — directly contradicting the claim in the same object. Corrected: the statement now
 * describes only Amir's own recorded numbers and states plainly that no squad-wide comparison
 * exists, rather than inventing teammate data to keep the old wording.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D03-DECISION-FLOW",
  fixtureId: "gate-d-w2-d03-coach-decision-flow",
  fixtureVersion: 3,
  fixtureSha256: "ecd08a477d276f9770b04f4691879baef6662017f187f94ec20aeeece5c12025",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const confirmHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-confirm-demo",
  statement:
    "Amir Haile's recorded minutes at left midfield have increased across the latest eligible window, and two recent observations describe growing comfort receiving in wide areas. This reflects increased on-pitch exposure at left midfield, not a demonstrated improvement in ability on its own. Confirming this as a development focus would track it explicitly rather than leaving it implicit.",
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-amir-lm-minutes", label: "Left midfield role minutes, previous 3 vs. latest 3 matches" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-amir-lm-comfort-1", label: "Coach observation, 27 Sep 2026 vs Asker" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-amir-lm-comfort-2", label: "Coach observation, 4 Oct 2026 vs Skedsmo" },
  ],
  contradictingRefs: [],
  missingEvidence: ["No observation yet on Amir's defensive recovery runs from left midfield"],
};

export const dismissHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-dismiss-demo",
  statement:
    "Amir Haile's recorded event rate while trailing increased between the two comparison windows. The previous window contained 2 recorded events across 108 trailing minutes, compared with 3 across 126 trailing minutes in the latest window. This is a small sample, and the reasons for the difference are unclear. A squad-wide comparison is not available, so this should not be interpreted as a demonstrated change in Amir's performance.",
  uncertainty: "HIGH",
  supportingRefs: [{ kind: "DERIVED_TREND", id: "trend-amir-trailing-rate", label: "Event rate while trailing, previous 3 vs. latest 3 matches" }],
  contradictingRefs: [],
  missingEvidence: ["No comparison against squad-wide trailing-rate baseline yet"],
};

export const errorHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-error-demo",
  statement:
    "Amir Haile's recorded shared pitch time with Jonas Berg has increased across the latest window, consistent with the pair being rotated together more often recently. This is exposure only — it does not establish partnership quality.",
  uncertainty: "LOW",
  supportingRefs: [{ kind: "DERIVED_TREND", id: "trend-amir-copresence", label: "Shared pitch time with Jonas Berg, previous 3 vs. latest 3 matches" }],
  contradictingRefs: [],
  missingEvidence: ["No qualitative observation yet on how Amir and Jonas interact on the pitch, only shared minutes"],
};

export const sources: EvidenceSourceMap = {
  "trend-amir-lm-minutes": {
    id: "trend-amir-lm-minutes",
    kind: "DERIVED_TREND",
    label: "Left midfield role minutes, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Minutes recorded at left midfield: 45 across the previous 3 matches (30 Aug - 20 Sep) -> 210 across the latest 3 matches (27 Sep - 11 Oct). Based on 6 total eligible matches this window. This is a measure of on-pitch exposure, not a measure of ability.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "obs-amir-lm-comfort-1": {
    id: "obs-amir-lm-comfort-1",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 27 Sep 2026 vs Asker",
    occurredAt: "27 Sep 2026",
    detail: "Received several passes in wide left areas under light pressure without rushing the next action.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "obs-amir-lm-comfort-2": {
    id: "obs-amir-lm-comfort-2",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 4 Oct 2026 vs Skedsmo",
    occurredAt: "4 Oct 2026",
    detail: "Looked increasingly comfortable receiving in wide left areas — took on a marker once rather than playing the easy ball back.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "trend-amir-trailing-rate": {
    id: "trend-amir-trailing-rate",
    kind: "DERIVED_TREND",
    label: "Event rate while trailing, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Marked moments recorded while trailing: 2 across 108 recorded trailing minutes in the previous 3 matches (30 Aug - 20 Sep, a rate of 1 per 54 minutes) -> 3 across 126 recorded trailing minutes in the latest 3 matches (27 Sep - 11 Oct, a rate of 1 per 42 minutes). Based on 6 total eligible matches this window.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "trend-amir-copresence": {
    id: "trend-amir-copresence",
    kind: "DERIVED_TREND",
    label: "Shared pitch time with Jonas Berg, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Shared pitch time with Jonas Berg: 95 minutes across the previous 3 matches (30 Aug - 20 Sep) -> 210 minutes across the latest 3 matches (27 Sep - 11 Oct). Based on 6 total eligible matches this window. This is shared on-pitch exposure only — it does not establish partnership quality or combination effectiveness.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
};

export const CONFIRM_ERROR_MESSAGE = "Could not record the development focus right now. Nothing was saved — try again shortly.";

export const confirmErrorByHypothesisId: Record<string, string> = {
  [errorHypothesis.id]: CONFIRM_ERROR_MESSAGE,
};

export const hypotheses: AssistantCoachHypothesisViewModel[] = [confirmHypothesis, dismissHypothesis, errorHypothesis];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D03-DECISION-FLOW", hypotheses, sources, confirmErrorByHypothesisId };
