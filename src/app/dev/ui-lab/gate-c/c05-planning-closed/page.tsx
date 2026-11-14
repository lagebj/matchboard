import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../w2-shared/round-board-fixture-harness";
import { buildC05PlanningClosedFixture } from "./fixtures";

/**
 * Gate C W2 — C05, Round Board planning closed with retained historical warnings.
 *
 * See `c04-planning-open/page.tsx` for why this is a plain server component. This fixture is a
 * genuinely MIXED boundary (one closed match, one still open) — see
 * `docs/ui-lab/gate-c-w2-candidates/CLOSED_STATE_RULES.md`.
 */
export default function C05PlanningClosedPage() {
  const fixture = buildC05PlanningClosedFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C05 &middot; Round Board — planning closed, historical warnings
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
