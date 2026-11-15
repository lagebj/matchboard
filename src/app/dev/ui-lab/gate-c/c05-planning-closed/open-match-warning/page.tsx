import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../../w2-shared/round-board-fixture-harness";
import { buildC05OpenMatchWarningFixture } from "../fixtures";

/**
 * Gate C W2 — C05, open-match-warning variant. A match-specific warning (no single player) on a
 * match that is still OPEN — the genuinely reachable, real-browser-testable counterpart to the
 * primary candidate's closed-match-warning case. Proves Resolve has a real effect on BOTH
 * desktop (scrolls the real match lane into view and focuses a useful control inside it) and
 * mobile (the existing match-first drill-in) for this kind of warning — remediation finding
 * "match-specific Resolve has no effective desktop behavior".
 */
export default function C05OpenMatchWarningPage() {
  const fixture = buildC05OpenMatchWarningFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C05 &middot; Round Board — match-specific warning, open match
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
