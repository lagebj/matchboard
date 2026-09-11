import { TouchlineButton } from "@/components/touchline";
import { WorkbenchToolbar } from "@/components/touchline/workbench/workbench-toolbar";
import { WorkbenchSummaryStrip } from "@/components/touchline/workbench/workbench-summary-strip";
import { RosterColumn } from "@/components/touchline/workbench/roster-column";
import { RosterRow } from "@/components/touchline/workbench/roster-row";
import { atlasNav, roundBoardViewModel, roundBoardPlayers } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Round Board — `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §A`. A dense professional workbench —
 * no decorative dashboard widgets above the work area, only the one approved
 * `WorkbenchSummaryStrip`. Drag/drop/move mutation logic is unchanged and out of scope for this
 * static composition demo.
 */
export default function AtlasRoundBoardPage() {
  const vm = roundBoardViewModel;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <WorkbenchToolbar
        context={<span className="font-[650] text-[var(--foreground)]">{vm.roundLabel}</span>}
        actions={<TouchlineButton variant="secondary">Regenerate</TouchlineButton>}
      />

      <div className="mt-4">
        <WorkbenchSummaryStrip items={vm.summaryItems} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 medium:grid-cols-3">
        {vm.columns.map((col) => (
          <RosterColumn key={col.matchId} title={col.title} meta={`${col.playerCount} players`}>
            {(roundBoardPlayers[col.matchId as keyof typeof roundBoardPlayers] ?? []).map((p) => (
              <RosterRow key={p.name} name={p.name} code={p.code} />
            ))}
          </RosterColumn>
        ))}
      </div>
    </UiLabShell>
  );
}
