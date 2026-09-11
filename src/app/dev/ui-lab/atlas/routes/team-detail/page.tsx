import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { CapacityBar } from "@/components/touchline/widget/capacity-bar";
import { atlasNav, teamDetailViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Team detail — `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §D`.
 * No invented "coaching intent" text — `activeFocuses` only renders when real `TeamFocus` rows
 * exist (provenance §0.17); an empty list stays empty, never a placeholder sentence.
 */
export default function AtlasTeamDetailPage() {
  const vm = teamDetailViewModel;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1000px]" navBuilder={atlasNav}>
      <TouchlinePageHeader
        title={vm.teamName}
        context={`${vm.gameFormat} · Support priority rank ${vm.supportPriorityRank}`}
        actions={<TouchlineButton variant="secondary">Configure</TouchlineButton>}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 medium:grid-cols-3">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Core squad" title={`${vm.corePlayerCount}/${vm.targetSquadSize}`} />
          <div className="mt-3"><CapacityBar value={vm.corePlayerCount} max={vm.targetSquadSize} /></div>
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Record" title={`${vm.record.matchesPlayed} played`} />
          <p className="mt-2 text-[13px] text-[var(--text-soft)]">{vm.record.wins}W {vm.record.draws}D {vm.record.losses}L</p>
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Rotation paths" title={`${vm.rotationPaths.length}`} />
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {vm.rotationPaths.map((p) => (
              <li key={p.id} className="text-[var(--text-soft)]">{p.direction === "outgoing" ? "→" : "←"} {p.counterpartTeamName} · {p.role}</li>
            ))}
          </ul>
        </TouchlineWidget>
      </div>

      {vm.activeFocuses.length > 0 ? (
        <div className="mt-5">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Team focus" title="Active" />
            <ul className="mt-2 flex flex-col gap-2 text-[13px]">
              {vm.activeFocuses.map((f) => (
                <li key={f.id} className="text-[var(--foreground)]">{f.statement}</li>
              ))}
            </ul>
          </TouchlineWidget>
        </div>
      ) : null}

      {vm.recentMovements.length > 0 ? (
        <div className="mt-5">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Movement" title="Recent" />
            <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
              {vm.recentMovements.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-[var(--foreground)]">{m.playerName}</span>
                  <span className="text-[var(--text-muted)]">{m.fromTeamName} → {m.toTeamName} · {m.role} · {m.roundLabel}</span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>
        </div>
      ) : null}
    </UiLabShell>
  );
}
