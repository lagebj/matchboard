import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../w2-shared/round-board-fixture-harness";
import { buildC04PlanningOpenFixture } from "./fixtures";

/**
 * Gate C W2 — C04, Round Board planning open with an unresolved player decision.
 *
 * A plain server component — matching the real production round page's own shape (server loader
 * -> client `RoundBoard`) — that computes the fixture exactly once per request and hands the
 * already-resolved, serializable result to the client harness. Gate C W1's own hydration-mismatch
 * incident (a client page component re-evaluating fixture data during hydration) is why this is
 * not a "use client" component computing the fixture directly.
 */
export default function C04PlanningOpenPage() {
  const fixture = buildC04PlanningOpenFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C04 &middot; Round Board — planning open, unresolved player decision
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
