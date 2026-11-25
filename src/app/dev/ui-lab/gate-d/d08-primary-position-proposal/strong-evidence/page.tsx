import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { PositionProposalReview } from "../shared/position-proposal-review";
import { proposal } from "./fixtures";

export default function D08StrongEvidencePage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d08-primary-position-proposal" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D08
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D08 &middot; Strong, unambiguous evidence
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        This is a directional design candidate for ADR-0160&apos;s decided policy — no such review
        surface exists in production yet.
      </p>
      <PositionProposalReview proposal={proposal} />
    </div>
  );
}
