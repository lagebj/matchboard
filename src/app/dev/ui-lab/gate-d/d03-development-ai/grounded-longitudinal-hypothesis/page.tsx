import Link from "next/link";
import { AppearanceControl, TouchlineWidget, WidgetHeader } from "@/components/touchline";
import { PlayerDevelopmentTimeline } from "@/components/touchline/player/player-development-timeline";
import { AssistantCoachHypothesisMount } from "../../w2-shared/assistant-coach-hypothesis-mount";
import { EvidenceSourceInspector } from "../../w2-shared/evidence-source-detail";
import { developmentInput, cycleInsight, cycleWindowWeeks, hypothesis, sources } from "./fixtures";

/**
 * Gate D W2 — D03, grounded longitudinal hypothesis with an existing coach focus. Reuses the
 * real Development-tab composition (`TouchlineWidget`/`WidgetHeader`/`PlayerDevelopmentTimeline`/
 * `AssistantCoachHypothesisPanel`, unmodified) so the relationship between an existing confirmed
 * focus, recorded observations, and an unconfirmed AI hypothesis matches production exactly. The
 * source inspector below the hypothesis is the one new, disclosed directional addition.
 */
export default function D03GroundedPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d03-development-ai" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D03
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D03 &middot; Grounded longitudinal hypothesis
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        Promote and Dismiss below are simulated: no Server Action is called, and no player-development record is written.
      </p>

      <div className="flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Development focus" title={developmentInput.activeFocus!.focus} />
          <div className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-soft)]">
            <p>{developmentInput.activeFocus!.rationale}</p>
            <p className="text-[12px] text-[var(--text-muted)]">
              Started {developmentInput.activeFocus!.startedAt} &middot; {developmentInput.activeFocus!.observationCount}{" "}
              observations &middot; Review due {developmentInput.activeFocus!.reviewDueAt}
            </p>
          </div>
          <p className="mt-2 text-[11px] italic text-[var(--text-muted)]">
            This is the coach&apos;s own existing, already-confirmed development focus — distinct from the Assistant Coach
            hypothesis below, which proposes an interpretation of recent evidence, not a replacement for it.
          </p>
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Assistant Coach &middot; Learning cycle" title={cycleInsight.title} />
          <p className="mt-2 text-[13px] text-[var(--text-soft)]">{cycleInsight.body}</p>
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">
            Based on the {cycleWindowWeeks}-week window {cycleInsight.windowLabel}.
          </p>
        </TouchlineWidget>

        <AssistantCoachHypothesisMount hypotheses={[hypothesis]} simulateActions />
        <EvidenceSourceInspector title="Cited sources" refs={[...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]} sources={sources} />

        <PlayerDevelopmentTimeline observations={developmentInput.observationTimeline} completedFocusHistory={developmentInput.completedFocusHistory} />
      </div>
    </div>
  );
}
