"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { computeExposureCoverage, observedExposures, buildSourceRecords } from "./view-model";
import { roleLabel, groupScopeLabel } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-sparse` — A04-S2. Two of six eligible
 * matches have usable role-duration evidence; the coaching question this scarcity actually
 * supports is "is there enough evidence yet to say anything about a trend" — and the honest
 * answer here is no. No sparkline, no growth arrow, no smoothed line, no inferred suitability
 * change (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S2).
 */
export default function RoleExposureSparsePage() {
  const inspector = useSourceInspector();
  const { observed, denominator } = computeExposureCoverage();
  const observations = observedExposures();
  const sources = buildSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S2 — Sparse role exposure</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{groupScopeLabel}</p>
      </div>

      <AppearanceControl />

      <EvidenceQuestionPanel
        question={`Is there enough recorded ${roleLabel} exposure to say whether this player's role suitability is changing?`}
        label={`${roleLabel} role exposure`}
        title={`${observed} of ${denominator} eligible matches with recorded exposure`}
        valueCaption="Not enough recorded matches to answer this question yet."
        visual={
          <ul className="flex flex-col gap-1.5" data-testid="s2-observed-list">
            {observations.map((o) => (
              <li
                key={o.matchLabel}
                className="flex items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-1.5 text-[12px] text-[var(--foreground)]"
                data-testid="s2-observed-row"
              >
                <span>{o.matchLabel}</span>
                <span className="font-medium">{o.minutes} min</span>
              </li>
            ))}
          </ul>
        }
        sample={`${denominator} eligible matches · ${groupScopeLabel}`}
        coverage="PARTIAL"
        onInspect={inspector.open}
      />

      <SourceInspector
        isOpen={inspector.isOpen}
        onClose={inspector.close}
        title="A04-S2 sources"
        description="Per-match role-duration records — the four with no recorded interval are listed, not hidden."
        sources={sources}
      />
    </div>
  );
}
