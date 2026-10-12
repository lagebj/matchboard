import type { ReactNode } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchInsights } from "@/components/matches/match-insights/match-insights";
import type { MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";
import { W4_MATCH_REFERENCE, W4_PLAYER_NAME, W4_PLAYER_SHIRT_NUMBER } from "../../shared/w4-assistant-coach-fixture";

/**
 * A08's own acceptance question ("no reserved gap when off; conspicuous trustworthy synthesis
 * when on; no filler") is a claim about ONE identical surrounding layout across three activation
 * states — not three independently styled pages that each merely assert parity in prose. This
 * harness is the one shared shell every A08 scenario renders; only `assistantCoachSlot` differs,
 * so a layout regression in one state is structurally visible in all three, and the test suite
 * can assert the slot container contributes zero extra DOM nodes when `assistantCoachSlot` is
 * `null` (the OFF case) rather than trusting a prose claim.
 */
export function ActivationHarness({
  title,
  fixedDateTimeUtc,
  matchInsights,
  assistantCoachSlot,
}: {
  title: string;
  fixedDateTimeUtc: string;
  matchInsights: MatchInsightsViewModel;
  /** `null` renders no Assistant Coach region at all — not an empty wrapper. */
  assistantCoachSlot: ReactNode | null;
}) {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A08 Assistant Coach activation parity
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">{title}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Player Detail</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">
          {W4_PLAYER_NAME} · №{W4_PLAYER_SHIRT_NUMBER}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{W4_MATCH_REFERENCE}</p>
      </div>

      {assistantCoachSlot !== null ? (
        <div data-testid="assistant-coach-slot" className="flex flex-col gap-2">
          {assistantCoachSlot}
        </div>
      ) : null}

      <MatchInsights viewModel={matchInsights} />
    </div>
  );
}
