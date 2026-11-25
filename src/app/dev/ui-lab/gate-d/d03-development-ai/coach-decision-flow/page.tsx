import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { AssistantCoachHypothesisMount } from "../../w2-shared/assistant-coach-hypothesis-mount";
import { hypotheses, confirmErrorByHypothesisId } from "./fixtures";

/**
 * Gate D W2 — D03, coach decision flow. Three pending hypotheses in one real
 * `AssistantCoachHypothesisPanel`, each demonstrating one outcome: a successful simulated
 * Promote, a successful simulated Dismiss, and a simulated Promote failure that leaves the card
 * pending with a visible error (mission §11: "Failure response where relevant" / "No unintended
 * persistent changes").
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

      <AssistantCoachHypothesisMount hypotheses={hypotheses} simulateActions confirmErrorByHypothesisId={confirmErrorByHypothesisId} />
    </div>
  );
}
