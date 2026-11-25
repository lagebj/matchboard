import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";

/**
 * Gate D Wave 2 — D03, coach decision flow. Three hypotheses, each demonstrating one branch of
 * the real `AssistantCoachHypothesisPanel` interaction (mission §6/§11): a successful simulated
 * Promote, a successful simulated Dismiss, and a simulated Promote failure. All three stay
 * pending until the coach acts — nothing here is pre-decided.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D03-DECISION-FLOW",
  fixtureId: "gate-d-w2-d03-coach-decision-flow",
  fixtureVersion: 1,
  fixtureSha256: "4a320362d2b67f1ce3d5040e98e0be50cbb06922b67b0722887657412da01054",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const confirmHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-confirm-demo",
  statement:
    "Amir Haile's recorded minutes at left midfield have increased across the latest eligible window, and two recent observations describe growing comfort receiving in wide areas. Confirming this as a development focus would track it explicitly rather than leaving it implicit.",
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-amir-lm-minutes", label: "Left midfield role minutes, previous 3 vs. latest 3 matches" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-amir-lm-comfort", label: "Coach observation, 4 Oct 2026 vs Skedsmo" },
  ],
  contradictingRefs: [],
  missingEvidence: ["No observation yet on Amir's defensive recovery runs from left midfield"],
};

export const dismissHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-dismiss-demo",
  statement:
    "Amir Haile's event rate while trailing has increased slightly across the latest window. This may reflect squad rotation rather than anything specific to Amir — the sample is small and several teammates show the same pattern.",
  uncertainty: "HIGH",
  supportingRefs: [{ kind: "DERIVED_TREND", id: "trend-amir-trailing-rate", label: "Event rate while trailing, previous 3 vs. latest 3 matches" }],
  contradictingRefs: [],
  missingEvidence: ["No comparison against squad-wide trailing-rate baseline yet"],
};

export const errorHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-error-demo",
  statement:
    "Amir Haile's co-presence with Jonas Berg has increased across the latest window, consistent with the pair being rotated together more often recently.",
  uncertainty: "LOW",
  supportingRefs: [{ kind: "DERIVED_TREND", id: "trend-amir-copresence", label: "Shared pitch time with Jonas Berg, previous 3 vs. latest 3 matches" }],
  contradictingRefs: [],
  missingEvidence: [],
};

export const CONFIRM_ERROR_MESSAGE = "Could not record the development focus right now. Nothing was saved — try again shortly.";

export const confirmErrorByHypothesisId: Record<string, string> = {
  [errorHypothesis.id]: CONFIRM_ERROR_MESSAGE,
};

export const hypotheses: AssistantCoachHypothesisViewModel[] = [confirmHypothesis, dismissHypothesis, errorHypothesis];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D03-DECISION-FLOW", hypotheses, confirmErrorByHypothesisId };
