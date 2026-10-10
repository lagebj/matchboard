"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { matchW3Identity, MATCH_W3_ROUND_LABEL } from "../../shared/match-w3-fixture";
import { buildDecisionCopy } from "./view-model";

/**
 * `/dev/ui-lab/gate-a/a03-decision-anatomy/open-decision` — A03-S1. Decision anatomy:
 * situation → permitted action → expected consequence → inspectable reason
 * (`03_INTERACTION_AND_POLICY_CONTRACT.md` "A03 state and feedback"). The "permitted action"
 * button is illustrative only — it never mutates anything and never navigates; it opens an inline
 * consequence panel. The real editing interaction lives in A07.
 */
export default function A03OpenDecisionPage() {
  const [consequenceOpen, setConsequenceOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const copy = buildDecisionCopy();
  const matchReference = `${matchW3Identity.homeTeam} vs ${matchW3Identity.awayTeam}`;

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a03-decision-anatomy" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A03 decision anatomy
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A03-S1 — Actionable decision</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {matchReference} · {MATCH_W3_ROUND_LABEL}
        </p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Situation</p>
        <p className="mt-1 text-[14px] text-[var(--foreground)]">{copy.situation}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConsequenceOpen((v) => !v)}
          className="self-start rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]"
        >
          {copy.actionLabel}
        </button>
        {consequenceOpen ? (
          <p data-testid="consequence-panel" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
            {copy.consequence}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setReasonOpen((v) => !v)} className="self-start text-[12px] text-[var(--text-muted)] underline">
          Why?
        </button>
        {reasonOpen ? (
          <p data-testid="reason-panel" className="rounded-lg border border-[var(--border-soft)] p-3 text-[12px] text-[var(--foreground)]">
            {copy.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
