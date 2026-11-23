import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCW3TodayMount } from "../../w3-shared/today-mount";
import { commandCentre, liveNow, projection, selectionDecisions, nowIso, assistantCoachContext } from "./fixtures";

/**
 * Gate C W3 — C07-STALE, outdated context. See `docs/ui-lab/gate-c-w3-candidates/` for the full
 * review record.
 */
export default function C07StalePage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c/c07-assistant-coach-fallback" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; C07
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C07-STALE &middot; Outdated context
      </h1>
      <GateCW3TodayMount
        commandCentre={commandCentre}
        liveNow={liveNow}
        projection={projection}
        selectionDecisions={selectionDecisions}
        assistantCoachContext={assistantCoachContext}
        nowIso={nowIso}
      />
    </div>
  );
}
