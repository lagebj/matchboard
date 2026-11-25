import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { AttributeRebasePanel } from "../shared/attribute-rebase-panel";
import { rows } from "./fixtures";

/**
 * Gate D W1 extension — D07, manual-edit precedence and attribute-level rebase (ADR-0160 §5).
 * `AttributeRebasePanel` is a directional design candidate — no production equivalent exists
 * yet. See `../shared/attribute-rebase-panel.tsx` for the disclosure.
 */
export default function D07ManualEditRebasePage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d07-attribute-evolution-review" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D07
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D07 &middot; Manual-edit precedence and attribute-level rebase
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        This is a directional design candidate for ADR-0160 §5&apos;s decided policy — no such
        attribute-level rebase surface exists in production yet (today&apos;s
        <code>Player.evidenceCutoverAt</code> is player-wide, not per attribute).
      </p>
      <AttributeRebasePanel rows={rows} />
    </div>
  );
}
