"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { computeCmProjection, buildSourceRecords } from "./view-model";
import { matchLabel } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/central-profile-projection` — A04-S5. One match, two
 * non-overlapping sided intervals (LCM 20m + RCM 10m), one CM profile contribution. The profile
 * number is a real projection of the real approved W1 aggregator, not an invented aggregate — the
 * drilldown still shows both exact positions (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S5).
 */
export default function CentralProfileProjectionPage() {
  const inspector = useSourceInspector();
  const projection = computeCmProjection();
  const sources = buildSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S5 — Central profile projection</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{matchLabel}</p>
      </div>

      <AppearanceControl />

      <EvidenceQuestionPanel
        question="How much recorded CM-profile playing time does this one match actually contribute?"
        label="CM profile evidence"
        title={`${projection.profile}: ${projection.totalMinutes} recorded minutes, ${projection.appearanceCount} distinct match`}
        value={`${projection.totalMinutes} min`}
        valueCaption="Projected from two exact sided positions recorded in the same match — not two matches, not double-counted."
        visual={
          <ul className="flex flex-col gap-1.5" data-testid="s5-breakdown-list">
            {projection.breakdown.map((b) => (
              <li
                key={b.tacticalPosition}
                data-testid="s5-breakdown-row"
                className="flex items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-1.5 text-[12px] text-[var(--foreground)]"
              >
                <span>{b.tacticalPosition}</span>
                <span className="font-medium">{b.minutes} min</span>
              </li>
            ))}
          </ul>
        }
        sample={matchLabel}
        coverage="COMPLETE"
        onInspect={inspector.open}
      />

      <SourceInspector
        isOpen={inspector.isOpen}
        onClose={inspector.close}
        title="A04-S5 sources"
        description="Two exact closed intervals from the same match, with the collapse-to-CM transformation named explicitly."
        sources={sources}
      />
    </div>
  );
}
