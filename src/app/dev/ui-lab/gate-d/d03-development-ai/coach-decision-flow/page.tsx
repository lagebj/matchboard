import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { AssistantCoachHypothesisMount } from "../../w2-shared/assistant-coach-hypothesis-mount";
import { EvidenceSourceInspector } from "../../w2-shared/evidence-source-detail";
import { hypotheses, confirmHypothesis, dismissHypothesis, errorHypothesis, sources, confirmErrorByHypothesisId } from "./fixtures";

/**
 * Gate D W2 — D03, coach decision flow. Three pending hypotheses in one real
 * `AssistantCoachHypothesisPanel`, each demonstrating one outcome: a successful simulated
 * Promote, a successful simulated Dismiss, and a simulated Promote failure that leaves the card
 * pending with a visible error (mission §11: "Failure response where relevant" / "No unintended
 * persistent changes").
 *
 * Remediation (owner review of PR #847, finding P1 #1): one `EvidenceSourceInspector` per
 * hypothesis, each with its own title naming the hypothesis it supports — never one combined,
 * ungrouped list of all four cited sources, which would leave a coach unable to tell which
 * source backs which hypothesis.
 */
export default function D03DecisionFlowPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d03-development-ai" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D03
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D03 &middot; Coach decision flow
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        Promote and Dismiss below are simulated: no Server Action is called, and no player-development record is written. The
        third hypothesis&apos;s Promote is simulated to fail, to show the real error-response path.
      </p>

      <div className="flex flex-col gap-4">
        <AssistantCoachHypothesisMount hypotheses={hypotheses} simulateActions confirmErrorByHypothesisId={confirmErrorByHypothesisId} />

        <EvidenceSourceInspector
          title="Cited sources — left-midfield exposure hypothesis"
          refs={[...confirmHypothesis.supportingRefs, ...confirmHypothesis.contradictingRefs]}
          sources={sources}
        />
        <EvidenceSourceInspector
          title="Cited sources — event-rate-while-trailing hypothesis"
          refs={[...dismissHypothesis.supportingRefs, ...dismissHypothesis.contradictingRefs]}
          sources={sources}
        />
        <EvidenceSourceInspector
          title="Cited sources — co-presence hypothesis"
          refs={[...errorHypothesis.supportingRefs, ...errorHypothesis.contradictingRefs]}
          sources={sources}
        />
      </div>
    </div>
  );
}
