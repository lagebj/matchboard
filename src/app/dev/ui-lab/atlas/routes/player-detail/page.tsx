"use client";

import { useState } from "react";
import { MoreHorizontal, Goal, Footprints } from "lucide-react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { OpportunityWidget, PositionExposureWidget } from "@/components/touchline/widgets";
import { MetricStrip } from "@/components/touchline/widget/metric-strip";
import { atlasNav, playerDetailViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const TABS = ["Overview", "Matches", "Development", "Evidence"] as const;

/**
 * Player detail — `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §B`. Golden: player-detail-mobile.png.
 *
 * No photo — identity is a large shirt-number/initials tile (see
 * docs/domain/touchline-atlas-provenance.md §0.6). No overall player score hero.
 * Order: identity → tabs → participation → OpportunityWidget → PositionExposureWidget →
 * development focus → latest observations → recent football rows.
 */
export default function AtlasPlayerDetailPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const vm = playerDetailViewModel;
  const initials = `${vm.identity.firstName[0]}${vm.identity.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <UiLabShell activeKey="players" contentWidthClass="max-w-[720px]" navBuilder={atlasNav}>
      <div className="flex items-start justify-between gap-3 pt-1">
        <p className="text-[12px] text-[var(--text-muted)]">
          {vm.identity.coreTeamName} · {vm.identity.groupLabel}
        </p>
        <button type="button" aria-label="More actions" className="shrink-0 text-[var(--text-muted)]">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget-strong)] text-[22px] font-[700] tabular-nums text-[var(--foreground)]">
          {vm.identity.shirtNumber ?? initials}
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] font-[650] leading-tight text-[var(--foreground)]">
            {vm.identity.firstName} {vm.identity.lastName}
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--accent)]">
            {vm.identity.shirtNumber ? `#${vm.identity.shirtNumber} · ` : ""}{vm.identity.primaryPosition}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-5 border-b border-[var(--border-soft)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={"relative pb-2.5 text-[14px] font-[600] " + (tab === t ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")}
          >
            {t}
            {tab === t ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--accent)]" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Participation" title="This season" />
          <div className="mt-3">
            <MetricStrip
              items={[
                { id: "matches", label: "Matches", value: String(vm.participation.matches) },
                { id: "goals", label: "Goals", value: String(vm.participation.goals) },
                { id: "assists", label: "Assists", value: String(vm.participation.assists) },
              ]}
            />
          </div>
        </TouchlineWidget>

        {vm.opportunity ? <OpportunityWidget {...vm.opportunity} /> : null}

        {vm.positionExposure.length > 0 ? (
          <PositionExposureWidget entries={vm.positionExposure.map((p) => ({ code: p.code, sharePercent: p.sharePercent }))} />
        ) : null}

        {vm.activeDevelopmentFocus ? (
          <TouchlineWidget>
            <WidgetHeader eyebrow="Development focus" title={vm.activeDevelopmentFocus.focus} />
          </TouchlineWidget>
        ) : null}

        {vm.latestObservations.length > 0 ? (
          <TouchlineWidget>
            <WidgetHeader eyebrow="Latest observation" title="Coach observation" />
            {vm.latestObservations.map((o) => (
              <blockquote key={o.id} className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-[14px] leading-snug text-[var(--text-soft)]">
                {o.note}
              </blockquote>
            ))}
          </TouchlineWidget>
        ) : null}

        {vm.recentMatches.length > 0 ? (
          <TouchlineWidget>
            <WidgetHeader title="Recent football" />
            <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
              {vm.recentMatches.map((m) => (
                <li key={m.matchId} className="flex items-center gap-3 py-2.5">
                  <span className="w-11 shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">{m.matchDate}</span>
                  <span className="min-w-0 flex-1 text-[14px] font-[600] text-[var(--foreground)]">{m.opponent}</span>
                  <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{m.role}</span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>
        ) : null}
      </div>
      {/* Icons referenced by the Design Atlas golden for goal/assist counts — reserved for the
          production migration's recent-football row treatment (Goal/Footprints). */}
      <span className="hidden"><Goal className="h-0 w-0" /><Footprints className="h-0 w-0" /></span>
    </UiLabShell>
  );
}
