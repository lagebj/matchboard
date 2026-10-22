import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { B06_EVENT_NAME, B06_EVENT_SQUAD_NAME, B06_EVENT_OPPONENT_NAME } from "../../../shared/match-b-fixture";

/**
 * B3-R5 — a real, fixture-backed stand-in for Event Detail's Matches tab (the production
 * surface this match genuinely lives on), separate from `CompareNav`'s reviewer-navigation
 * strip. This is the real origin/return point for the Event journey: Event Detail → this match
 * → Live Reporting → report → back here — the coarser, Event-scoped destination `event/after`'s
 * own disclosure describes, now demonstrated as a real link rather than only prose.
 */
export default function B06EventDetailPage() {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — Event Detail</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {B06_EVENT_NAME} · {B06_EVENT_SQUAD_NAME}
        </p>
      </div>

      <AppearanceControl />

      <DecisionBanner
        variant="note"
        title="This Event's own page, not a page scoped to one match"
        description="Every match in this Event is a card on this same page's Matches tab. Leaving any one match's lineup or report returns here — to the whole Event, not to a page scoped to just that match."
      />

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Matches
        </p>
        <Link
          href="/dev/ui-lab/gate-b/b06-league-event-parity/event/before"
          className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          <span>vs {B06_EVENT_OPPONENT_NAME}</span>
          <span className="text-[11px] text-[var(--text-muted)]">Planned, ready</span>
        </Link>
        <span className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/10 px-3 py-2 text-[13px] text-[var(--text-muted)]">
          Live Reporting — shared production surface, not reproduced here
        </span>
        <Link
          href="/dev/ui-lab/gate-b/b06-league-event-parity/event/after"
          className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          <span>vs {B06_EVENT_OPPONENT_NAME} — completed</span>
          <span className="text-[11px] text-[var(--text-muted)]">Report locked</span>
        </Link>
      </div>
    </div>
  );
}
