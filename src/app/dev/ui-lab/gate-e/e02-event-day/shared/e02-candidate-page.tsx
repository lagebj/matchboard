import { Suspense } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import type { E02EventDayFixture } from "./event-day-fixture-types";
import { EventDayFixtureMount } from "./event-day-fixture-mount";

/**
 * Shared page frame for every E02 child candidate. UI-Lab-only chrome (back link, appearance
 * control, scenario label) stays at a narrow reading width, deliberately separated from the
 * product surface below it, which uses the real app shell's own content container
 * (`src/app/(app)/layout.tsx`: `max-w-[96rem] px-4 ... sm:px-6`) — not an artificially narrow
 * column (the Gate E W1 E01-R2 lesson). `pb-8` instead of the shell's `py-5` avoids doubling the
 * chrome block's own top spacing; disclosed, not overlooked.
 */
export function E02CandidatePage({ label, fixture }: { label: string; fixture: E02EventDayFixture }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-2 px-4 pt-8">
        <Link href="/dev/ui-lab/gate-e/e02-event-day" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; E02
        </Link>
        <AppearanceControl />
      </div>
      <p className="mx-auto mb-4 max-w-[720px] px-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        E02 &middot; {label} &middot; fixture v{fixture.identity.fixtureVersion}
      </p>
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>}>
        <div className="mx-auto w-full max-w-[96rem] px-4 pb-8 sm:px-6" data-e02-product-surface="">
          <EventDayFixtureMount fixture={fixture} />
        </div>
      </Suspense>
    </div>
  );
}
