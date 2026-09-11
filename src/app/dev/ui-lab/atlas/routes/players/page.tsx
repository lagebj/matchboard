import { TouchlinePageHeader } from "@/components/touchline";
import { TouchlineInspector } from "@/components/touchline/workbench/touchline-inspector";
import { InspectorFact } from "@/components/touchline/workbench/touchline-inspector";
import { StackedDistribution } from "@/components/touchline/viz";
import { atlasNav, playerRoster, selectedPlayerInspector } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Players overview — `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §A`.
 * Golden: atlas-planning-and-matchday.png panel 6.
 * Desktop: 9-col dense roster + 3-col selected-player inspector. Rating is never the primary
 * ranking column (docs/domain/touchline-atlas-provenance.md).
 */
export default function AtlasPlayersPage() {
  return (
    <UiLabShell activeKey="players" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Players" context="Season overview and participation" />

      <div className="mt-5 flex flex-col gap-6 large:flex-row">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="py-2 pr-3 font-semibold">Player</th>
                <th className="py-2 pr-3 font-semibold">Core team</th>
                <th className="py-2 pr-3 font-semibold">Position</th>
                <th className="py-2 pr-3 font-semibold">Availability</th>
                <th className="py-2 pr-3 font-semibold">Played</th>
                <th className="py-2 pr-3 font-semibold">Core</th>
                <th className="py-2 pr-3 font-semibold">Support</th>
                <th className="py-2 pr-3 font-semibold">Development</th>
                <th className="py-2 font-semibold">Attention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {playerRoster.map((p) => (
                <tr key={p.playerId} className={p.playerId === selectedPlayerInspector.playerId ? "bg-[var(--tl-c-surface-selected)]" : undefined}>
                  <td className="py-2.5 pr-3 font-[600] text-[var(--foreground)]">{p.displayName}</td>
                  <td className="py-2.5 pr-3 text-[var(--text-soft)]">{p.coreTeamName}</td>
                  <td className="py-2.5 pr-3 text-[var(--text-muted)]">{p.primaryPosition}</td>
                  <td className="py-2.5 pr-3 text-[var(--text-soft)]">{p.availability}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{p.actualAppearances}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{p.coreAppearances}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{p.supportAppearances}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{p.developmentAppearances}</td>
                  <td className="py-2.5 text-[var(--warning)]">{p.attention ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hidden large:block">
          <TouchlineInspector title={selectedPlayerInspector.displayName} headline={`${selectedPlayerInspector.primaryPosition} · ${selectedPlayerInspector.coreTeamName}`}>
            <InspectorFact label="Season">
              {selectedPlayerInspector.seasonAppearances} played · {selectedPlayerInspector.seasonGoals} goals · {selectedPlayerInspector.seasonAssists} assists
            </InspectorFact>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Position exposure</p>
              <StackedDistribution
                question="Position exposure"
                segments={selectedPlayerInspector.positionExposure.map((p) => ({ label: p.code, value: p.share }))}
              />
            </div>
            <InspectorFact label="Availability">{selectedPlayerInspector.availability}</InspectorFact>
            {selectedPlayerInspector.developmentFocus ? (
              <InspectorFact label="Development focus">{selectedPlayerInspector.developmentFocus}</InspectorFact>
            ) : null}
          </TouchlineInspector>
        </div>
      </div>
    </UiLabShell>
  );
}
