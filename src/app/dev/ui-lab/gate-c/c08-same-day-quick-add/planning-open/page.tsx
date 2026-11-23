import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCW3TodayMount } from "../../w3-shared/today-mount";
import { commandCentre, liveNow, selectionDecisions, projection, nowIso } from "./fixtures";

/**
 * Gate C W3 — C08-A, planning open. A plain server component mounting the real, unmodified
 * production `TodaySurface`. See `docs/ui-lab/gate-c-w3-candidates/` for the full review record.
 */
export default function C08PlanningOpenPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c/c08-same-day-quick-add" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; C08
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C08-A &middot; Planning open
      </h1>
      <GateCW3TodayMount
        commandCentre={commandCentre}
        liveNow={liveNow}
        selectionDecisions={selectionDecisions}
        projection={projection}
        nowIso={nowIso}
      />
    </div>
  );
}
