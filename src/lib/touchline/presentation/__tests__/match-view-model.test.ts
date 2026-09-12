import { describe, it, expect } from "vitest";
import { buildMatchViewModel, isSafeFitDiagnostic, type MatchViewModelInput } from "../match-view-model";

function makeInput(overrides: Partial<MatchViewModelInput> = {}): MatchViewModelInput {
  return {
    matchId: "m1",
    teamName: "Rød",
    opponent: "Blå",
    startsAt: "2026-09-20T09:00:00Z",
    venue: "Home",
    lifecycleStatus: "planning_open",
    checks: [],
    availability: { available: 0, doubtful: 0, unavailable: 0 },
    planningAttention: [],
    squadBalance: { core: 0, support: 0, development: 0, matchday: 0 },
    ...overrides,
  };
}

describe("buildMatchViewModel", () => {
  it("counts completed checks and total checks", () => {
    const vm = buildMatchViewModel(
      makeInput({
        checks: [
          { key: "squad", label: "Squad selected", complete: true },
          { key: "lineup", label: "Lineup set", complete: false },
          { key: "report", label: "Report complete", complete: false },
        ],
      }),
    );
    expect(vm.preparationCompleteCount).toBe(1);
    expect(vm.preparationTotalCount).toBe(3);
  });

  it("returns zero completed out of zero total when there are no checks", () => {
    const vm = buildMatchViewModel(makeInput({ checks: [] }));
    expect(vm.preparationCompleteCount).toBe(0);
    expect(vm.preparationTotalCount).toBe(0);
  });

  it("sums squadBalance into squadTotal", () => {
    const vm = buildMatchViewModel(
      makeInput({ squadBalance: { core: 9, support: 2, development: 1, matchday: 1 } }),
    );
    expect(vm.squadTotal).toBe(13);
  });

  it("passes through every input field unchanged", () => {
    const input = makeInput({ teamName: "Hvit", opponent: "Granli" });
    const vm = buildMatchViewModel(input);
    expect(vm.teamName).toBe("Hvit");
    expect(vm.opponent).toBe("Granli");
    expect(vm.matchId).toBe(input.matchId);
  });
});

describe("isSafeFitDiagnostic", () => {
  it("recognises the rotation-generator's 'no safe replacement' diagnostic", () => {
    expect(isSafeFitDiagnostic("No safe replacement for LB at 32 min")).toBe(true);
  });

  it("recognises the lineup generator's 'no safe automatic fit' diagnostic", () => {
    expect(isSafeFitDiagnostic("No safe automatic fit for CM")).toBe(true);
  });

  it("returns false for an unrelated diagnostic string", () => {
    expect(isSafeFitDiagnostic("Squad below minimum accepted size")).toBe(false);
  });
});
