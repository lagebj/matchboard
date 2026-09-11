"use client";

import { useState } from "react";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { CapacityBar } from "@/components/touchline/widget/capacity-bar";
import { atlasNav, eventSquadViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Event squad — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §C`. Mobile authority:
 * event-squad-mobile.png. Guest players render at the same visual level as normal players —
 * `isGuest` is a small secondary "Guest" tag only, never a diminished row treatment.
 */
export default function AtlasEventSquadPage() {
  const vm = eventSquadViewModel;
  const [selected, setSelected] = useState(vm.squadId);

  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[560px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Event squad" context={`vs ${vm.opponentSummary}`} />

      {vm.squadRail.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {vm.squadRail.map((s) => (
            <button
              key={s.squadId}
              type="button"
              onClick={() => setSelected(s.squadId)}
              className={
                "shrink-0 rounded-[var(--tl-c-radius-control)] border px-3 py-1.5 text-[13px] font-[600] " +
                (s.squadId === selected
                  ? "border-[var(--accent)] bg-[var(--tl-widget-strong)] text-[var(--foreground)]"
                  : "border-[var(--border-soft)] text-[var(--text-muted)]")
              }
            >
              {s.label} <span className="tabular-nums text-[var(--text-muted)]">{s.currentCount}/{s.targetSize}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <h1 className="text-[20px] font-[650] text-[var(--foreground)]">{vm.squadName}</h1>
        <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
          {vm.currentCount}/{vm.targetSize} · {vm.guestCount} guest{vm.guestCount === 1 ? "" : "s"}
          {vm.spotsLeft > 0 ? ` · ${vm.spotsLeft} spot${vm.spotsLeft === 1 ? "" : "s"} left` : ""}
        </p>
        <div className="mt-3">
          <CapacityBar value={vm.currentCount} max={vm.targetSize} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <TouchlineButton variant="primary">Plan lineup</TouchlineButton>
        <TouchlineButton variant="secondary">Manage squad</TouchlineButton>
      </div>

      <ul className="mt-5 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {vm.players.map((p) => (
          <li key={p.participantId} className="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] text-[12px] font-[650] tabular-nums text-[var(--foreground)]">
              {p.shirtNumber ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-[600] text-[var(--foreground)]">{p.displayName}</span>
                {p.isGuest ? (
                  <span className="shrink-0 rounded-full bg-[var(--tl-widget-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Guest</span>
                ) : null}
              </span>
              <span className="block text-[12px] text-[var(--text-muted)]">{p.position ?? "—"} · {p.availabilityLabel}</span>
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="mt-3 w-full rounded-[var(--tl-c-radius-control)] border border-dashed border-[var(--border-soft)] py-2.5 text-[13px] font-[600] text-[var(--text-muted)]">
        + Add player
      </button>
    </UiLabShell>
  );
}
