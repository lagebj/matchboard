import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { AssistantCoachHypothesisMount } from "../../w2-shared/assistant-coach-hypothesis-mount";
import { EvidenceSourceInspector } from "../../w2-shared/evidence-source-detail";
import { hypothesis, sources } from "./fixtures";

/**
 * Gate D W2 — D06, genuine cross-source contradiction. An earlier formal assessment and a more
 * recent observation disagree about the same substantive question (centre-back readiness).
 * Neither is silently discarded or treated as superseding the other — the hypothesis discloses
 * both and leaves the resolution to the coach.
 */
export default function D06ContradictionPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d06-cross-source-hypothesis" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D06
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D06 &middot; Genuine cross-source contradiction
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        Promote and Dismiss below are simulated: no Server Action is called, and no player-development record is written.
      </p>

      <div className="flex flex-col gap-4">
        <AssistantCoachHypothesisMount hypotheses={[hypothesis]} simulateActions />
        <EvidenceSourceInspector title="Cited sources" refs={[...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]} sources={sources} />
      </div>
    </div>
  );
}
