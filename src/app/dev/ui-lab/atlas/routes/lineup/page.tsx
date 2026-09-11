import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TacticsBoard } from "@/components/formations/tactics-board";
import { BenchRail } from "@/components/touchline/workbench/bench-rail";
import { atlasNav, lineupSlots, lineupPlayers, lineupAssignments, lineupBench } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Lineup — `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D` (match-detail sub-tab).
 * Reuses the existing production `TacticsBoard` (`mode="lineup-assignment"`) and `BenchRail` —
 * no second pitch component (provenance §0.9).
 */
export default function AtlasLineupPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Lineup" context="Rød vs Graabein United" actions={<TouchlineButton variant="secondary">Suggest lineup</TouchlineButton>} />

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-8">
          <TacticsBoard
            mode="lineup-assignment"
            slots={lineupSlots}
            assignments={lineupAssignments}
            players={lineupPlayers}
            readOnly={false}
            pitchStyle="perspective"
          />
        </div>
        <div className="expanded:col-span-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Bench</p>
          <BenchRail players={lineupBench} />
        </div>
      </div>
    </UiLabShell>
  );
}
