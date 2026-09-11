import { TouchlinePageHeader, TouchlineButton, ScorebookMatchRow } from "@/components/touchline";
import { CapacityBar } from "@/components/touchline/widget/capacity-bar";
import { EvidenceSpotlightWidget } from "@/components/touchline/widgets";
import { atlasNav, seasonViewModel, recentMatches, insightsViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Season overview — `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §E`.
 * No external competition standings — season identity/progress/participation/evidence only.
 */
export default function AtlasSeasonPage() {
  const vm = seasonViewModel;
  const spotlight = insightsViewModel.groups[0]?.primary;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Season" context={`${vm.displayLabel} · ${vm.status === "OPEN" ? "In progress" : "Finalised"}`} actions={<TouchlineButton variant="secondary">Export</TouchlineButton>} />

      <div className="mt-5 grid grid-cols-1 gap-5 medium:grid-cols-2">
        <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
          <p className="text-[12px] text-[var(--text-muted)]">Round progress</p>
          <p className="mt-1 tl-sport text-[22px] font-[650] text-[var(--foreground)]">{vm.finalizedRoundCount}/{vm.roundCount} rounds</p>
          <div className="mt-2"><CapacityBar value={vm.finalizedRoundCount} max={Math.max(1, vm.roundCount)} /></div>
        </div>
        <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
          <p className="text-[12px] text-[var(--text-muted)]">Participation coverage</p>
          <p className="mt-1 tl-sport text-[22px] font-[650] text-[var(--foreground)]">{vm.participationCoveragePercent}%</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{vm.playersWithAppearance}/{vm.totalCorePlayers} players with a finalized appearance</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Recent matches</p>
        <div className="flex flex-col divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {recentMatches.map((m) => <ScorebookMatchRow key={m.id} presentation={m} />)}
        </div>
      </div>

      {spotlight ? (
        <div className="mt-6">
          <EvidenceSpotlightWidget
            question={spotlight.title}
            label={spotlight.label}
            title={spotlight.title}
            value={spotlight.value}
            valueCaption={spotlight.valueCaption}
            sample={spotlight.sample}
            confidence={spotlight.confidence}
            detailHref={spotlight.detailHref}
          />
        </div>
      ) : null}
    </UiLabShell>
  );
}
