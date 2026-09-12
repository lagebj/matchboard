import type { WorkbenchSummaryItem } from "@/components/touchline/workbench/workbench-summary-strip";

/**
 * Round Board workbench summary strip (Touchline Design Atlas,
 * `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §A`: "Keep as dense professional workbench... no
 * decorative dashboard widgets above the work area", only the one approved
 * `WorkbenchSummaryStrip` — a Touchline Finish primitive (ADR-0135) purpose-built for exactly
 * this spot, but never actually wired into the real Round Board until now.
 *
 * A 1:1 port of `RoundStatusStrip`'s existing conditional-metric logic (same facts, same
 * conditions for showing each one) into the new primitive's flatter, denser strip grammar --
 * no new query, no new fact, no domain-logic change. `RoundStatusStrip`/`MetricTile`-grid
 * rendering is the "dashboard card" pattern the spec calls out; `WorkbenchSummaryStrip` is its
 * prescribed replacement.
 */
export interface RoundWorkbenchSummaryInput {
  totalTeams: number;
  completeTeams: number;
  teamsNeedingSupport: number;
  squadRepairNeeded: number;
  blockedCount: number;
  decisionRequiredCount: number;
  totalSelected: number;
  totalTarget: number;
}

export function buildRoundWorkbenchSummaryItems(input: RoundWorkbenchSummaryInput): WorkbenchSummaryItem[] {
  const items: WorkbenchSummaryItem[] = [
    {
      id: "squads-filled",
      label: "Squads filled",
      value: `${input.completeTeams}/${input.totalTeams}`,
      tone: "neutral",
    },
  ];

  if (input.teamsNeedingSupport > 0) {
    items.push({ id: "support-needed", label: "Support needed", value: String(input.teamsNeedingSupport), tone: "attention" });
  }
  if (input.squadRepairNeeded > 0) {
    items.push({ id: "squad-repair", label: "Squad repair", value: String(input.squadRepairNeeded), tone: "attention" });
  }
  if (input.blockedCount > 0) {
    items.push({ id: "blocked", label: "Blocked", value: String(input.blockedCount), tone: "danger" });
  }
  if (input.decisionRequiredCount > 0) {
    items.push({ id: "decisions", label: "Decisions", value: String(input.decisionRequiredCount), tone: "attention" });
  }

  items.push({
    id: "squad-places",
    label: "Squad places",
    value: `${input.totalSelected}/${input.totalTarget}`,
    tone: "neutral",
  });

  return items;
}
