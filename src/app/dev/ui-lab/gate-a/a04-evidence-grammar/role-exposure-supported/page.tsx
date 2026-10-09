"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { computeWindowComparison, buildSourceRecords } from "./view-model";
import { roleLabel, groupScopeLabel } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-supported` — A04-S3. Six complete,
 * comparable measured intervals support one descriptive comparison: prior 3 vs latest 3 recorded
 * `CM` minutes. The permitted conclusion is strictly "recorded exposure was {direction} in the
 * latest three matches in this sample" — never faster development, higher skill, or causal
 * coaching improvement (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S3).
 */
export default function RoleExposureSupportedPage() {
  const inspector = useSourceInspector();
  const comparison = computeWindowComparison();
  const sources = buildSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S3 — Supported role exposure comparison</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{groupScopeLabel}</p>
      </div>

      <AppearanceControl />

      <EvidenceQuestionPanel
        question={`Was this player's recorded ${roleLabel} exposure higher, lower, or unchanged across their six most recent complete matches?`}
        label={`${roleLabel} role exposure — descriptive comparison`}
        title={`Recorded ${roleLabel} exposure was ${comparison.direction} in the latest three matches in this sample`}
        value={`${comparison.priorTotal} → ${comparison.latestTotal} min`}
        valueCaption={`Prior ${comparison.priorDenominator} matches vs latest ${comparison.latestDenominator} matches`}
        visual={
          <div className="grid grid-cols-2 gap-3" data-testid="s3-window-comparison">
            <div data-testid="s3-prior-window">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Prior {comparison.priorDenominator}
              </p>
              <ul className="flex flex-col gap-1">
                {comparison.priorMatches.map((m) => (
                  <li key={m.matchLabel} className="flex items-center justify-between text-[12px] text-[var(--foreground)]">
                    <span>{m.matchLabel}</span>
                    <span className="font-medium">{m.minutes} min</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-testid="s3-latest-window">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Latest {comparison.latestDenominator}
              </p>
              <ul className="flex flex-col gap-1">
                {comparison.latestMatches.map((m) => (
                  <li key={m.matchLabel} className="flex items-center justify-between text-[12px] text-[var(--foreground)]">
                    <span>{m.matchLabel}</span>
                    <span className="font-medium">{m.minutes} min</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        }
        sample={`6 distinct matches · same role definition and time unit · ${groupScopeLabel}`}
        coverage="COMPLETE"
        onInspect={inspector.open}
      />

      <p className="text-[11px] text-[var(--text-muted)]">
        Descriptive comparison of complete measured intervals only — not a performance rating, not
        a claim about unobserved matches, and not a universal six-match sufficiency rule.
      </p>

      <SourceInspector
        isOpen={inspector.isOpen}
        onClose={inspector.close}
        title="A04-S3 sources"
        description="Six recorded role-duration intervals, same role/time-unit basis."
        sources={sources}
      />
    </div>
  );
}
