import Link from "next/link";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { atlasNav, eventListViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Events list — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §A`.
 * Golden: touchline-v1 events references + atlas-planning-and-matchday.png context.
 * No "New event" card artwork/photo — a plain text row list, date-grouped, past events receding.
 */
export default function AtlasEventsPage() {
  const vm = eventListViewModel;

  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Events" context="Cups, tournaments, and friendly days" actions={<TouchlineButton variant="primary">New event</TouchlineButton>} />

      {vm.nextEvent ? (
        <div className="mt-5 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget-strong)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">Next event</p>
          <p className="mt-1 text-[18px] font-[650] text-[var(--foreground)]">{vm.nextEvent.name}</p>
          <p className="mt-0.5 text-[13px] text-[var(--text-soft)]">
            {formatEventDate(vm.nextEvent.startsAt)}
            {vm.nextEvent.opponentSummary ? ` · ${vm.nextEvent.opponentSummary}` : ""} · {vm.nextEvent.readiness}
          </p>
        </div>
      ) : null}

      {vm.upcoming.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Upcoming</p>
          <ul className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {vm.upcoming.map((e) => (
              <li key={e.eventId}>
                <Link href="#" className="flex items-center justify-between gap-3 py-3 no-underline">
                  <span>
                    <span className="block text-[14px] font-[600] text-[var(--foreground)]">{e.name}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">{formatEventDate(e.startsAt)}{e.opponentSummary ? ` · ${e.opponentSummary}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{e.readiness}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.past.length > 0 ? (
        <div className="mt-6 opacity-60">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Past</p>
          <ul className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {vm.past.map((e) => (
              <li key={e.eventId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[13px] text-[var(--text-soft)]">{e.name}</span>
                <span className="text-[12px] text-[var(--text-muted)]">{formatEventDate(e.startsAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </UiLabShell>
  );
}
