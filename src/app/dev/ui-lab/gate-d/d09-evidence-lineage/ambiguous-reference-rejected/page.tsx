import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RejectedExtractionDisplay } from "../shared/rejected-extraction-display";
import { submission } from "./fixtures";

/**
 * Gate D W1 extension — D09, ambiguous-reference-rejected state. Demonstrates the real
 * `validateExtractionSemantics` behavior: an unresolvable player reference discards the whole
 * extraction response, producing zero observations — not a kept-but-flagged-ambiguous one. See
 * `../shared/rejected-extraction-display.tsx` for the full disclosure.
 */
export default function D09AmbiguousReferenceRejectedPage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d09-evidence-lineage" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D09
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D09 &middot; Ambiguous reference
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        No phantom rating from an unresolvable reference — the real contract rejects the whole
        submission rather than keeping a weak observation.
      </p>
      <RejectedExtractionDisplay submission={submission} />
    </div>
  );
}
