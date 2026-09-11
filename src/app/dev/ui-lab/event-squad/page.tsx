import { MoreHorizontal, Users, Upload, Plus } from "lucide-react";
import {
  TouchlinePageHeader,
  TouchlineButton,
  TouchlineContextRail,
  TouchlineWidget,
  CapacityBar,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { eventSquadRail, eventSquadCapacity, eventSquadPlayers } from "../fixtures";

/**
 * Golden: event-squad-mobile (390×844). Touchline Finish & Visual
 * Convergence follow-up (`08_PLAYER_EVENT_INSIGHTS_AND_OVERVIEWS.md §2`).
 * Composition: event header → squad rail → selected squad identity/count →
 * capacity bar → primary actions → dense roster → add-player affordance.
 */
export default function UiLabEventSquadPage() {
  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[560px]">
      <div className="flex items-start justify-between gap-3 pt-1">
        <TouchlinePageHeader title="Skrim Kiwi Bama Cup" context="Saturday 12 Sep · Slemmestad IF · Pitch 3" />
        <TouchlineButton variant="ghost" size="sm" aria-label="More actions">
          <MoreHorizontal className="h-5 w-5" />
        </TouchlineButton>
      </div>

      <div className="mt-4">
        <TouchlineContextRail aria-label="Squad" items={eventSquadRail} selectedId="rod" />
      </div>

      <TouchlineWidget className="mt-4" padding="normal">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-c-live)] text-[15px] font-[700] text-white"
          >
            R
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-[650] text-[var(--foreground)]">Rød</p>
            <p className="text-[13px] text-[var(--text-muted)]">Skrim United</p>
          </div>
          <p className="tl-sport shrink-0 text-[26px] font-[700] text-[var(--foreground)]">
            {eventSquadCapacity.value} / {eventSquadCapacity.max}
            <span className="ml-1 text-[13px] font-normal text-[var(--text-muted)]">players</span>
          </p>
        </div>
        <div className="mt-3">
          <CapacityBar value={eventSquadCapacity.value} max={eventSquadCapacity.max} />
        </div>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          {eventSquadCapacity.max - eventSquadCapacity.value} spots left · 1 guest player
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <TouchlineButton variant="secondary" leadingIcon={<Users className="h-4 w-4" />}>
            Manage squad
          </TouchlineButton>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <TouchlineButton variant="primary" fullWidth className="medium:w-auto">
            Create lineup →
          </TouchlineButton>
          <TouchlineButton variant="secondary" leadingIcon={<Upload className="h-4 w-4" />} fullWidth className="medium:w-auto">
            Export squad
          </TouchlineButton>
        </div>
      </TouchlineWidget>

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-[620] text-[var(--foreground)]">Players</h2>
          <span className="text-[12px] text-[var(--text-muted)]">Shirt number</span>
        </div>
        <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {eventSquadPlayers.map((p) => (
            <li key={p.number} className="flex items-center gap-3 py-2.5">
              <span className="w-6 shrink-0 text-right text-[13px] tabular-nums text-[var(--text-muted)]">
                {p.number}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-[600] text-[var(--foreground)]">
                {p.name}
              </span>
              <span className="w-8 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {p.code}
              </span>
              <span
                className={
                  "w-24 shrink-0 text-right text-[13px] " +
                  (p.status === "guest"
                    ? "font-medium text-[var(--tl-c-evidence)]"
                    : p.status === "unavailable"
                      ? "text-[var(--text-muted)]"
                      : "text-[var(--accent)]")
                }
              >
                {p.detail}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 flex w-full items-center gap-3 rounded-[var(--tl-radius-widget)] border border-dashed border-[var(--border-strong)] px-3.5 py-3 text-left text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span>
            <span className="block text-[14px] font-[600]">Add player</span>
            <span className="block text-[12px]">From club, guest player, or create new</span>
          </span>
        </button>
      </section>
    </UiLabShell>
  );
}
