import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MaterialApprovalReview } from "../shared/material-approval-review";
import { proposal } from "./fixtures";

/**
 * Gate D W1 extension — D07, material-approval-required state. `MaterialApprovalReview` is a
 * directional design candidate (ADR-0160 §4) — this review surface does not exist in production
 * yet. See `../shared/material-approval-review.tsx` for the disclosure.
 */
export default function D07PendingMaterialApprovalPage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d07-attribute-evolution-review" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D07
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D07 &middot; Material change — approval required
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        This is a directional design candidate for ADR-0160&apos;s decided policy — no such review
        surface exists in production yet.
      </p>
      <MaterialApprovalReview proposal={proposal} />
    </div>
  );
}
