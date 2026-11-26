import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { NoDefensibleHypothesis } from "../../w2-shared/no-defensible-hypothesis";
import { noHypothesisState } from "./fixtures";

/**
 * Gate D W2 — D06, sparse cross-source evidence. None of the three evidence families the
 * register expects (trend, observation, position history) are individually sufficient — the
 * page does not force a complete cross-source narrative out of them, and keeps the different
 * kinds of gap (missing data, insufficient sample, no contrary evidence, coach uncertainty)
 * distinguishable rather than collapsed into one vague line.
 */
export default function D06SparsePage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d06-cross-source-hypothesis" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D06
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D06 &middot; Sparse cross-source evidence
      </h1>

      <NoDefensibleHypothesis {...noHypothesisState} />
    </div>
  );
}
