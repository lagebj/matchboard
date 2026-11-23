import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { AssessmentHistoryDisplay } from "../shared/assessment-history-display";
import { changes } from "./fixtures";

/**
 * Gate D W1 extension — D07, non-material automatic attribute change. Reproduces the real
 * `AssessmentHistoryPanel`'s rendering (see `../shared/assessment-history-display.tsx`) over
 * fixture data — not a mount of that component directly, since it owns its own data fetch.
 */
export default function D07AutomaticNonMaterialPage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d07-attribute-evolution-review" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D07
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D07 &middot; Non-material automatic change
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        This change is within ADR-0160 §4&apos;s automatic bounds (≤1 point, ≥3 matches,
        confidence ≥0.7, within 1 point of baseline) and applies without coach approval, exactly
        as today&apos;s production evidence engine already does.
      </p>
      <AssessmentHistoryDisplay changes={changes} />
    </div>
  );
}
