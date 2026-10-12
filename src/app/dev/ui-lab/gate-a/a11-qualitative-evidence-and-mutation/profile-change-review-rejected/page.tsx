"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { ProfileChangeReviewCard, useProfileChangeReview } from "../shared/profile-change-review-card";
import { identity, proposal, PLAYER_NAME, PLAYER_SHIRT_NUMBER } from "./fixtures";

/**
 * A11-profile-change-review-rejected — coach rejects the proposal; `useProfileChangeReview`'s
 * authoritative declared-primary value stays at `proposal.currentPrimary` throughout (independent
 * review finding R5), proving no change, no implicit write.
 */
export default function A11ProfileChangeReviewRejectedPage() {
  const review = useProfileChangeReview(proposal.currentPrimary, proposal.proposedPrimary);

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A11 Qualitative evidence + mutation
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A11 — Guarded profile change review (rejected)</h1>
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
