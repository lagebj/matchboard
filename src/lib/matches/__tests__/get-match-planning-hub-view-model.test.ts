import { describe, it, expect } from "vitest";
import { buildMatchPlanningHubViewModel, type MatchPlanningHubInput } from "../get-match-planning-hub-view-model";

function makeInput(overrides: Partial<MatchPlanningHubInput> = {}): MatchPlanningHubInput {
  return {
    matchId: "m1",
    teamName: "Rød",
    opponent: "Blå",
    startsAt: "2026-09-20T09:00:00Z",
    venue: "Home",
    lifecycleStatus: "planning_open",
    selections: [],
    priorityWarnings: [],
    formatWarningTitle: (code) => code,
    postMatchStatus: null,
    hasLineup: false,
    ...overrides,
  };
}

describe("buildMatchPlanningHubViewModel", () => {
  it("marks 'squad selected' complete only when there is at least one selection", () => {
    const withSelections = buildMatchPlanningHubViewModel(makeInput({ selections: [{ role: "CORE" }] }));
    expect(withSelections.checks.find((c) => c.key === "squad")?.complete).toBe(true);

    const withoutSelections = buildMatchPlanningHubViewModel(makeInput({ selections: [] }));
    expect(withoutSelections.checks.find((c) => c.key === "squad")?.complete).toBe(false);
  });

  it("marks 'lineup set' complete exactly from the hasLineup flag", () => {
    expect(buildMatchPlanningHubViewModel(makeInput({ hasLineup: true })).checks.find((c) => c.key === "lineup")?.complete).toBe(true);
    expect(buildMatchPlanningHubViewModel(makeInput({ hasLineup: false })).checks.find((c) => c.key === "lineup")?.complete).toBe(false);
  });

  it("marks 'report complete' true for REPORTED or LOCKED, false otherwise", () => {
    for (const status of ["REPORTED", "LOCKED"]) {
      expect(buildMatchPlanningHubViewModel(makeInput({ postMatchStatus: status })).checks.find((c) => c.key === "report")?.complete).toBe(true);
    }
    for (const status of ["DRAFT", null, undefined]) {
      expect(buildMatchPlanningHubViewModel(makeInput({ postMatchStatus: status })).checks.find((c) => c.key === "report")?.complete).toBe(false);
    }
  });

  it("surfaces only the single highest-priority warning as planning attention", () => {
    const vm = buildMatchPlanningHubViewModel(
      makeInput({
        priorityWarnings: [
          { code: "SQUAD_BELOW_MINIMUM", message: "Squad below minimum accepted size" },
          { code: "SELECTED_PLAYER_UNAVAILABLE", message: "A selected player is unavailable" },
        ],
        formatWarningTitle: (code) => `Formatted: ${code}`,
      }),
    );
    expect(vm.planningAttention).toEqual([{ title: "Formatted: SQUAD_BELOW_MINIMUM", detail: "Squad below minimum accepted size" }]);
  });

  it("has no planning attention when there are no priority warnings", () => {
    expect(buildMatchPlanningHubViewModel(makeInput({ priorityWarnings: [] })).planningAttention).toEqual([]);
  });

  it("tallies squad balance from the selections list", () => {
    const vm = buildMatchPlanningHubViewModel(
      makeInput({ selections: [{ role: "CORE" }, { role: "CORE" }, { role: "SUPPORT" }] }),
    );
    expect(vm.squadBalance).toEqual({ core: 2, support: 1, development: 0, matchday: 0 });
    expect(vm.squadTotal).toBe(3);
  });
});
