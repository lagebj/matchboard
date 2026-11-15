import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { RoundBoardFixtureHarness } from "../../../w2-shared/round-board-fixture-harness";
import { buildC05OpenMatchWarningDeniedFixture } from "../../fixtures";

/**
 * Gate C W2 — C05, open-match-warning/denied variant. Same round as the open-match-warning
 * candidate, plus one deliberately rejected destination for the resolved candidate into the
 * short match itself (third remediation pass §5 "Rejection scenario") — a genuinely reachable
 * route, not only exercised at the component-test layer, proving a match-targeted Resolve's
 * commit shows the real reason and leaves the target/candidate/assignment unchanged on a
 * server rejection, never a false success.
 */
export default function C05OpenMatchWarningDeniedPage() {
  const fixture = buildC05OpenMatchWarningDeniedFixture();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C05 &middot; Round Board — match-targeted Resolve, denied assignment
      </h1>
      <RoundBoardFixtureHarness initial={fixture} />
    </div>
  );
}
