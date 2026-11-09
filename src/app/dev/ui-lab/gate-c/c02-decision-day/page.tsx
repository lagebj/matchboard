import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCTodayMount } from "../shared/today-mount";
import { commandCentre, liveNow, projection, selectionDecisions } from "./fixtures";

/**
 * Gate C W1 — C02, Decision day. A plain server component (matching the real production
 * `today/page.tsx`'s own shape) that mounts the real, unmodified production `TodaySurface`
 * against a fixture with one genuine top decision and three genuine secondary candidates across
 * all three secondary sources — proving the real 2-item cap and duplicate-decision suppression,
 * not a hand-picked two-item look. See `docs/ui-lab/gate-c-w1-candidates/` for the full review
 * record.
 */
export default function C02DecisionDayPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate C
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C02 &middot; Decision day
      </h1>
      <GateCTodayMount
        commandCentre={commandCentre}
        liveNow={liveNow}
        projection={projection}
        selectionDecisions={selectionDecisions}
      />
    </div>
  );
}
