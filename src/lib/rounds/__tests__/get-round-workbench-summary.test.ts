import { describe, it, expect } from "vitest";
import { buildRoundWorkbenchSummaryItems, type RoundWorkbenchSummaryInput } from "../get-round-workbench-summary";

function makeInput(overrides: Partial<RoundWorkbenchSummaryInput> = {}): RoundWorkbenchSummaryInput {
  return {
    totalTeams: 3,
    completeTeams: 3,
    teamsNeedingSupport: 0,
    squadRepairNeeded: 0,
    blockedCount: 0,
    decisionRequiredCount: 0,
    totalSelected: 24,
    totalTarget: 24,
    ...overrides,
  };
}

describe("buildRoundWorkbenchSummaryItems", () => {
  it("always includes 'Squads filled' and 'Squad places'", () => {
    const items = buildRoundWorkbenchSummaryItems(makeInput());
    expect(items.map((i) => i.id)).toEqual(["squads-filled", "squad-places"]);
  });

  it("shows 'Squads filled' as completeTeams/totalTeams", () => {
    const items = buildRoundWorkbenchSummaryItems(makeInput({ completeTeams: 2, totalTeams: 3 }));
    expect(items.find((i) => i.id === "squads-filled")?.value).toBe("2/3");
  });

  it("adds 'Support needed' only when teamsNeedingSupport > 0, with attention tone", () => {
    expect(buildRoundWorkbenchSummaryItems(makeInput({ teamsNeedingSupport: 0 })).some((i) => i.id === "support-needed")).toBe(false);
    const items = buildRoundWorkbenchSummaryItems(makeInput({ teamsNeedingSupport: 2 }));
    const item = items.find((i) => i.id === "support-needed");
    expect(item).toEqual({ id: "support-needed", label: "Support needed", value: "2", tone: "attention" });
  });

  it("adds 'Squad repair' only when squadRepairNeeded > 0", () => {
    expect(buildRoundWorkbenchSummaryItems(makeInput({ squadRepairNeeded: 0 })).some((i) => i.id === "squad-repair")).toBe(false);
    expect(buildRoundWorkbenchSummaryItems(makeInput({ squadRepairNeeded: 1 })).some((i) => i.id === "squad-repair")).toBe(true);
  });

  it("adds 'Blocked' only when blockedCount > 0, with danger tone", () => {
    expect(buildRoundWorkbenchSummaryItems(makeInput({ blockedCount: 0 })).some((i) => i.id === "blocked")).toBe(false);
    const item = buildRoundWorkbenchSummaryItems(makeInput({ blockedCount: 1 })).find((i) => i.id === "blocked");
    expect(item?.tone).toBe("danger");
  });

  it("adds 'Decisions' only when decisionRequiredCount > 0", () => {
    expect(buildRoundWorkbenchSummaryItems(makeInput({ decisionRequiredCount: 0 })).some((i) => i.id === "decisions")).toBe(false);
    expect(buildRoundWorkbenchSummaryItems(makeInput({ decisionRequiredCount: 3 })).some((i) => i.id === "decisions")).toBe(true);
  });

  it("orders conditional items: support, repair, blocked, decisions, then squad places last", () => {
    const items = buildRoundWorkbenchSummaryItems(
      makeInput({ teamsNeedingSupport: 1, squadRepairNeeded: 1, blockedCount: 1, decisionRequiredCount: 1 }),
    );
    expect(items.map((i) => i.id)).toEqual([
      "squads-filled",
      "support-needed",
      "squad-repair",
      "blocked",
      "decisions",
      "squad-places",
    ]);
  });
});
