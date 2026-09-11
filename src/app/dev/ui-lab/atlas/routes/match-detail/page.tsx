"use client";

import { useState } from "react";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { SquadReadinessWidget } from "@/components/touchline/widgets";
import { atlasNav, matchViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const TABS = ["Overview", "Squad", "Lineup", "Tactics", "Rotations", "Matchday", "Report"] as const;

/**
 * Match detail / planning hub — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §D`.
 * Golden: atlas-planning-and-matchday.png panel 5.
 *
 * No arbitrary "completion %" — `preparationCompleteCount/preparationTotalCount` is a real
 * count of existing checklist booleans (squad/lineup/report), not an invented percentage.
 */
export default function AtlasMatchDetailPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const vm = matchViewModel;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader
        title={`${vm.teamName} vs ${vm.opponent}`}
        context={vm.venue ? `${vm.venue}` : undefined}
        actions={<TouchlineButton variant="secondary">Edit</TouchlineButton>}
      />

      <div className="mt-4 flex gap-5 border-b border-[var(--border-soft)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={"relative shrink-0 pb-2.5 text-[14px] font-[600] " + (tab === t ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")}
          >
            {t}
            {tab === t ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--accent)]" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-8">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Squad" title={`${vm.squadTotal} planned`} />
            <div className="mt-3 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Core", value: vm.squadBalance.core },
                { label: "Support", value: vm.squadBalance.support },
                { label: "Development", value: vm.squadBalance.development },
                { label: "Matchday", value: vm.squadBalance.matchday },
              ].map((b) => (
                <div key={b.label}>
                  <p className="tl-sport text-[20px] font-[650] text-[var(--foreground)]">{b.value}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{b.label}</p>
                </div>
              ))}
            </div>
          </TouchlineWidget>
        </div>

        <div className="expanded:col-span-4 flex flex-col gap-4">
          <SquadReadinessWidget
            title="Availability"
            available={vm.availability.available}
            doubtful={vm.availability.doubtful}
            unavailable={vm.availability.unavailable}
            exceptions={[]}
          />

          <TouchlineWidget>
            <WidgetHeader eyebrow="Preparation" title={`${vm.preparationCompleteCount}/${vm.preparationTotalCount} complete`} />
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              {vm.checks.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  <span aria-hidden="true" className={"h-1.5 w-1.5 rounded-full " + (c.complete ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]")} />
                  <span className={c.complete ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>

          {vm.planningAttention.length > 0 ? (
            <TouchlineWidget>
              <WidgetHeader eyebrow="Planning attention" title={vm.planningAttention[0].title} />
              <p className="mt-2 text-[13px] text-[var(--text-soft)]">{vm.planningAttention[0].detail}</p>
            </TouchlineWidget>
          ) : null}
        </div>
      </div>
    </UiLabShell>
  );
}
