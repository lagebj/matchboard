import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { ParticipationLoadWidget, RoleUsageWidget, MovementHistoryWidget } from "@/components/touchline/widgets";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav, historyViewModel } from "../../fixtures";

/**
 * History — `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §C`.
 * Golden: atlas-football-intelligence.png panel 2, visual grammar corrected by the route spec —
 * this stays a selection/movement history view, NOT a match archive
 * (docs/domain/touchline-atlas-provenance.md §3). "Review steps"/"How to read this page" are
 * removed from the primary hierarchy per the spec.
 */
export default function AtlasHistoryPage() {
  const vm = historyViewModel;

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="History" context="Selection history, movement, and load" actions={<TouchlineButton variant="secondary">Export</TouchlineButton>} />

      <div className="mt-5 grid grid-cols-2 gap-3 medium:grid-cols-4">
        {[
          { label: "Finalised appearances", value: vm.summary.totalFinalizedAppearances },
          { label: "Support appearances", value: vm.summary.totalSupportAppearances },
          { label: "Development appearances", value: vm.summary.totalDevelopmentAppearances },
          { label: "Players with movement", value: vm.summary.playersWithMovement },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-3.5">
            <p className="tl-sport text-[24px] font-[650] text-[var(--foreground)]">{s.value}</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-7">
          <ParticipationLoadWidget
            distribution={vm.appearanceDistribution.map((b) => ({ label: b.label, value: b.count }))}
            loadRange={vm.loadRange}
          />
        </div>
        <div className="expanded:col-span-5">
          <RoleUsageWidget
            counts={{
              core: vm.roleUsage.find((r) => r.label === "Core")?.value ?? 0,
              support: vm.roleUsage.find((r) => r.label === "Support")?.value ?? 0,
              development: vm.roleUsage.find((r) => r.label === "Development")?.value ?? 0,
              squadRepair: vm.roleUsage.find((r) => r.label === "Squad repair")?.value ?? 0,
            }}
          />
        </div>

        <div className="expanded:col-span-12">
          <MovementHistoryWidget
            strip={vm.movementPaths.map((p, i) => ({ id: String(i), label: `${p.fromTeamName} → ${p.toTeamName}`, sublabel: `${p.role} · ${p.count}`, tone: "accent" as const }))}
            recentRows={vm.recentMovements.map((m, i) => ({
              id: String(i),
              playerName: m.playerName,
              fromTeamName: m.fromTeamName ?? "—",
              toTeamName: m.teamName,
              role: m.role,
              roundLabel: m.matchRoundName,
            }))}
          />
        </div>
      </div>
    </UiLabShell>
  );
}
