"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { ProfileChangeReviewCard, useProfileChangeReview } from "../shared/profile-change-review-card";
import { identity, proposal, PLAYER_NAME, PLAYER_SHIRT_NUMBER } from "./fixtures";

/**
 * A11-profile-change-review-guarded — coach reviews and ACCEPTS a primary-position proposal.
 * `useProfileChangeReview` models the authoritative declared-primary value explicitly (independent
 * review finding R5); acceptance changes it exactly once, and no real provider or database write
 * occurs (`docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md` W4-BLK-09).
 */
export default function A11ProfileChangeReviewGuardedPage() {
  const review = useProfileChangeReview(proposal.currentPrimary, proposal.proposedPrimary);

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A11 Qualitative evidence + mutation
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A11 — Guarded profile change review</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Player Detail</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">
          {PLAYER_NAME} · №{PLAYER_SHIRT_NUMBER}
        </p>
      </div>

      <ProfileChangeReviewCard
        proposal={proposal}
        authoritativePrimary={review.authoritativePrimary}
        outcome={review.outcome}
        onAccept={review.accept}
        onReject={review.reject}
        onDefer={review.defer}
      />
    </div>
  );
}
