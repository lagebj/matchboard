import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceLineageDisplay } from "../shared/evidence-lineage-display";
import { entries } from "./fixtures";

/**
 * Gate D W1 extension — D09, superseded-lineage state. `EvidenceLineageDisplay` is new
 * presentation built directly from real qualitative-evidence field shapes and the real
 * `supersededAt` behavior — no existing production component surfaces this lineage today. See
 * `../shared/evidence-lineage-display.tsx` for the full disclosure.
 */
export default function D09SupersededLineagePage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d09-evidence-lineage" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D09
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D09 &middot; Observation lineage
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        Exposes real supersession machinery (ADR-0152) that no production UI currently surfaces to
        a coach. Edit and Retract below are simulated.
      </p>
      <EvidenceLineageDisplay entries={entries} interactive />
    </div>
  );
}
