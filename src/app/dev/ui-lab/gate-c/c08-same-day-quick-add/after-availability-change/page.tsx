import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { GateCW3TodayMount } from "../../w3-shared/today-mount";
import { commandCentre, liveNow, selectionDecisions, projection, nowIso } from "./fixtures";

/**
 * Gate C W3 — C08-B, tentative availability, planning still open. Matchboard has no RSVP-deadline
 * mechanism (confirmed by code inspection — `PlannedAbsenceReason.NO_RSVP` is a manually-selected
 * category, not a computed deadline), so the official register's "after RSVP" state is BLOCKED,
 * not satisfied by this scenario. This demonstrates the real, adjacent mechanism that does exist
 * (`TENTATIVE` `Player.currentAvailability`) as disclosed supplementary coverage — see
 * `docs/ui-lab/gate-c-w3-candidates/BLOCKERS.md` and `C08_OPERATIONAL_ACCEPTANCE.md`.
 */
export default function C08AfterAvailabilityChangePage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-c/c08-same-day-quick-add" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; C08
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        C08-B &middot; Tentative availability (supplementary — not an RSVP deadline)
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        Matchboard has no RSVP-deadline mechanism. The official register&apos;s &quot;after
        RSVP&quot; requirement is BLOCKED by this gap, not satisfied here.
      </p>
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
