"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { MatchInsights } from "@/components/matches/match-insights/match-insights";
import { AssistantCoachHypothesisCard, type AssistantCoachHypothesisOutcome } from "../../shared/assistant-coach-hypothesis-card";
import { identity, hypothesis, matchInsights } from "./fixtures";
import { matchReference, playerLabel } from "./view-model";

/**
 * A05-enabled-with-pattern — a conspicuous, trustworthy hypothesis card (A08's own acceptance
 * question for this state), cited evidence, uncertainty, and missing-evidence disclosure. Promote
 * /dismiss are simulated locally — see `assistant-coach-hypothesis-card.tsx`'s own doc comment for
 * why the real `AssistantCoachHypothesisPanel` could not be reused as-is (W4-BLK-10).
 */
export default function A05EnabledWithPatternPage() {
  const [outcome, setOutcome] = useState<AssistantCoachHypothesisOutcome>(null);

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A05 Assistant Coach semantic grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A05 — Enabled, with pattern</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Player Detail</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">{playerLabel}</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{matchReference}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Assistant Coach hypotheses</p>
        <AssistantCoachHypothesisCard
          hypothesis={hypothesis}
          outcome={outcome}
          onPromote={() => setOutcome("PROMOTED")}
          onDismiss={() => setOutcome("DISMISSED")}
        />
      </div>

      <MatchInsights viewModel={matchInsights} />

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="fixture-simulation-caption">
        Fixture-only simulated promote/dismiss · No server called · Production authorization not verified.
      </p>
    </div>
  );
}
