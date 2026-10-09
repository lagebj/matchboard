"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { computeOpportunityCoverage, buildSourceRecords } from "./view-model";
import { eligibleRounds, groupScopeLabel, actualMinutesMeasure } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/partial-minutes` — A04-S1. Answers one question: did
 * this player actually play, or only have the chance to? The eligible-opportunity denominator
 * (5/5) and the missing actual-minutes measurement are both real, both shown together, and never
 * merged into one confidence-sounding number.
 */
export default function PartialMinutesPage() {
  const inspector = useSourceInspector();
  const { numerator, denominator } = computeOpportunityCoverage();
  const sources = buildSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S1 — Opportunity vs actual minutes</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{groupScopeLabel}</p>
      </div>

      <AppearanceControl />

      <EvidenceQuestionPanel
        question="Did this player actually play in their eligible rounds, or only have the chance to?"
        label="Participation evidence"
        title={`${numerator}/${denominator} eligible rounds with a recorded opportunity`}
        value={`${numerator}/${denominator}`}
        valueCaption="eligible rounds with an opportunity record"
        visual={
          <ul className="flex flex-wrap gap-1.5" data-testid="s1-opportunity-strip">
            {eligibleRounds.map((round) => (
              <li
                key={round.roundId}
                data-testid="s1-round-chip"
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-2.5 py-1 text-[11px] text-[var(--foreground)]"
              >
                {round.roundLabel}
              </li>
            ))}
          </ul>
        }
        sample={`${denominator} distinct rounds · ${groupScopeLabel}`}
        coverage="COMPLETE"
        onInspect={inspector.open}
      />

      <EvidenceQuestionPanel
        question="How many actual minutes did this player record in these rounds?"
        label="Actual minutes"
        title="Minutes: Not recorded"
        valueCaption={`This fixture measures ${actualMinutesMeasure.measureName}, not played minutes — no closed playing interval exists for any of the five rounds above.`}
        sample={groupScopeLabel}
        coverage={actualMinutesMeasure.coverage}
        onInspect={inspector.open}
        inspectLabel="Inspect minutes source"
      />

      <SourceInspector
        isOpen={inspector.isOpen}
        onClose={inspector.close}
        title="A04-S1 sources"
        description="Opportunity records and the actual-minutes measurement scope — read-only."
        sources={sources}
      />
    </div>
  );
}
