"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { matchW3Identity, MATCH_W3_ROUND_LABEL } from "../../shared/match-w3-fixture";
import { buildSignalCopy } from "./view-model";

/**
 * `/dev/ui-lab/gate-a/a03-decision-anatomy/integrity-signal` — A03-S4. A Round-Board-style
 * plan-integrity signal that points back to the match/round as its source — never a second
 * fairness/eligibility resolver. There is no "Resolve" action on this page; the "Why" toggle only
 * reveals the underlying fixture fact.
 */
export default function A03IntegritySignalPage() {
  const [reasonOpen, setReasonOpen] = useState(false);
  const copy = buildSignalCopy();
  const matchReference = `${matchW3Identity.homeTeam} vs ${matchW3Identity.awayTeam}`;

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a03-decision-anatomy" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A03 decision anatomy
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A03-S4 — Round Board integrity signal</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {MATCH_W3_ROUND_LABEL} · {matchReference}
        </p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Plan integrity signal</p>
        <p className="mt-1 text-[14px] text-[var(--foreground)]">{copy.signal}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setReasonOpen((v) => !v)} className="self-start text-[12px] text-[var(--text-muted)] underline">
          Why?
        </button>
        {reasonOpen ? (
          <p data-testid="signal-reason-panel" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
            {copy.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
