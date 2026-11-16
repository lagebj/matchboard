import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../../w2-shared/round-board-fixture-harness";
import { buildC06WithDeniedAssignmentFixture } from "../fixtures";

/**
 * Gate C W2 — C06, denied-assignment variant. Same round as the primary C06 candidate, plus one
 * deliberately rejected destination (Gate C W2 remediation, P1-05 / brief §7 "show pending,
 * rejection and conflict outcomes truthfully") — a genuinely reachable route, not only exercised
 * at the component-test layer, so a real browser can prove the UI never shows a successful
 * result before a real accepted one.
 */
export default function C06DeniedAssignmentPage() {
  const fixture = buildC06WithDeniedAssignmentFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C06 &middot; Round Board — denied assignment (truthful rejection)
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
