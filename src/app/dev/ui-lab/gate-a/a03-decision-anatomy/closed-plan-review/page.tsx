"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { matchW3ClosedIdentity, MATCH_W3_ROUND_LABEL } from "../../shared/match-w3-fixture";
import { buildReviewCopy } from "./view-model";

/**
 * `/dev/ui-lab/gate-a/a03-decision-anatomy/closed-plan-review` — A03-S2. `planning_closed` is
 * read-only for plan changes: "Review plan" toggles a read-only explanation, never a
 * Save/Resolve/Assign control, and never implies an exception
 * (`03_INTERACTION_AND_POLICY_CONTRACT.md` "A03 state and feedback").
 */
export default function A03ClosedPlanReviewPage() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const copy = buildReviewCopy();
  const matchReference = `${matchW3ClosedIdentity.homeTeam} vs ${matchW3ClosedIdentity.awayTeam}`;

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a03-decision-anatomy" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A03 decision anatomy
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A03-S2 — Closed plan review</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {matchReference} · {MATCH_W3_ROUND_LABEL} · Planning closed
        </p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)]/30 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Situation</p>
        <p className="mt-1 text-[14px] text-[var(--foreground)]">The plan for this match is now final. No further plan changes are possible.</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setReviewOpen((v) => !v)}
          className="self-start rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[13px] text-[var(--foreground)]"
        >
          Review plan
        </button>
        {reviewOpen ? (
          <p data-testid="review-panel" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
            {copy.review}
          </p>
        ) : null}
      </div>
    </div>
  );
}
