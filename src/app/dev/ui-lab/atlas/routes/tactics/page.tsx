import { TouchlinePageHeader } from "@/components/touchline";
import { TacticsBoard } from "@/components/formations/tactics-board";
import { TouchlineInspector } from "@/components/touchline/workbench/touchline-inspector";
import { PositionFitList } from "@/components/touchline/workbench/position-fit-list";
import { atlasNav, lineupSlots, lineupPlayers, lineupAssignments, positionFitEntries } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Tactics — `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D` (match-detail sub-tab). Read-only
 * `TacticsBoard` + `PositionFitList` inspector — the same canonical ADR-0129 tier vocabulary,
 * never a re-derived percentage.
 */
export default function AtlasTacticsPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1100px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Tactics" context="Rød vs Graabein United" />

      <div className="mt-5 flex flex-col gap-6 large:flex-row">
        <div className="min-w-0 flex-1">
          <TacticsBoard
            mode="lineup-readonly"
            slots={lineupSlots}
            assignments={lineupAssignments}
            players={lineupPlayers}
            readOnly
            pitchStyle="perspective"
          />
        </div>
        <div className="hidden large:block">
          <TouchlineInspector title="Emil Sørensen" headline="Left Wing">
            <PositionFitList entries={positionFitEntries} selectedTier="NATURAL" />
          </TouchlineInspector>
        </div>
      </div>
    </UiLabShell>
  );
}
