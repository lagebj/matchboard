"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { ProfileChangeReviewCard, type ProfileChangeReviewOutcome } from "../shared/profile-change-review-card";
import { identity, proposal, PLAYER_NAME, PLAYER_SHIRT_NUMBER } from "./fixtures";

/**
 * A11-profile-change-review-guarded — coach reviews and ACCEPTS a primary-position proposal.
 * Acceptance is a local, simulated outcome only; no real provider or database write occurs
 * (`docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md` W4-BLK-09).
 */
export default function A11ProfileChangeReviewGuardedPage() {
  const [outcome, setOutcome] = useState<ProfileChangeReviewOutcome>(null);

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

      <ProfileChangeReviewCard proposal={proposal} outcome={outcome} onAccept={() => setOutcome("ACCEPTED")} onReject={() => setOutcome("REJECTED")} onDefer={() => setOutcome("DEFERRED")} />
    </div>
  );
}
