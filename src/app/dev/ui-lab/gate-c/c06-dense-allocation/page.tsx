import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../w2-shared/round-board-fixture-harness";
import { buildC06DenseAllocationFixture } from "./fixtures";

/**
 * Gate C W2 — C06, Round Board dense allocation and position-precision disclosure.
 *
 * See `c04-planning-open/page.tsx` for why this is a plain server component. The position-
 * precision question is answered as a disclosed gap, not fabricated data — see
 * `docs/ui-lab/gate-c-w2-candidates/POSITION_VOCABULARY_AND_PRECISION.md`.
 */
export default function C06DenseAllocationPage() {
  const fixture = buildC06DenseAllocationFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C06 &middot; Round Board — dense allocation, position-precision disclosure
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
