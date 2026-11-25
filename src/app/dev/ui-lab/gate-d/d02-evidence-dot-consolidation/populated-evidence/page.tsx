import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceGroups } from "../shared/evidence-groups";
import { stories } from "./fixtures";

/**
 * Gate D W1 — D02, populated evidence across all four groups (Opportunity, Position, Match
 * context, Trend). Mounts the real `EvidenceStory`/`Sparkline`/`StackedDistribution` components
 * via the shared `EvidenceGroups` helper, which reproduces the Evidence tab's own grouped-
 * rendering block exactly.
 */
export default function D02PopulatedEvidencePage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d02-evidence-dot-consolidation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D02
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D02 &middot; Populated evidence
      </h1>
      <EvidenceGroups stories={stories} />
    </div>
  );
}
