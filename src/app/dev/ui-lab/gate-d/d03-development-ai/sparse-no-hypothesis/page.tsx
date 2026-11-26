import Link from "next/link";
import { AppearanceControl, TouchlineWidget, WidgetHeader } from "@/components/touchline";
import { PlayerDevelopmentTimeline } from "@/components/touchline/player/player-development-timeline";
import { NoDefensibleHypothesis } from "../../w2-shared/no-defensible-hypothesis";
import { developmentInput, noHypothesisState } from "./fixtures";

/**
 * Gate D W2 — D03, sparse longitudinal evidence. Demonstrates the required "no defensible
 * conclusion" state (mission §6): one match, one observation, no derived trend, and no Assistant
 * Coach hypothesis. `NoDefensibleHypothesis` is a disclosed directional addition — production's
 * real panel would render nothing at all here (an empty hypotheses array returns `null`), which
 * would leave a coach with no explanation for the section's absence.
 */
export default function D03SparsePage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d03-development-ai" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D03
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D03 &middot; Sparse evidence, no defensible hypothesis
      </h1>

      <div className="flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Development focus" title={developmentInput.activeFocus!.focus} />
          <div className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-soft)]">
            <p>{developmentInput.activeFocus!.rationale}</p>
            <p className="text-[12px] text-[var(--text-muted)]">
              Started {developmentInput.activeFocus!.startedAt} &middot; {developmentInput.activeFocus!.observationCount} observation
            </p>
          </div>
        </TouchlineWidget>

        <NoDefensibleHypothesis {...noHypothesisState} />

        <PlayerDevelopmentTimeline observations={developmentInput.observationTimeline} completedFocusHistory={developmentInput.completedFocusHistory} />
      </div>
    </div>
  );
}
