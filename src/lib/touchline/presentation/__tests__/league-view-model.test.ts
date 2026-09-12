import { describe, it, expect } from "vitest";
import { buildLeagueViewModel, type LeaguePeriodInput } from "../league-view-model";

function round(overrides: Partial<LeaguePeriodInput["rounds"][number]> & { id: string }) {
  return {
    title: overrides.id,
    selectionState: "DRAFT" as const,
    blockerCount: 0,
    decisionRequiredCount: 0,
    matches: [],
    isCurrent: false,
    ...overrides,
  };
}

describe("buildLeagueViewModel", () => {
  it("picks the round explicitly marked current as the feature round", () => {
    const periods: LeaguePeriodInput[] = [
      {
        id: "p1",
        title: "Autumn 2026",
        isCurrent: true,
        rounds: [
          round({ id: "r1", selectionState: "FINALIZED" }),
          round({ id: "r2", isCurrent: true }),
          round({ id: "r3" }),
        ],
      },
    ];
    const vm = buildLeagueViewModel(periods);
    expect(vm.featureRound?.id).toBe("r2");
    expect(vm.historyRounds.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("falls back to the first non-finalized round when none is marked current", () => {
    const periods: LeaguePeriodInput[] = [
      {
        id: "p1",
        title: "Autumn 2026",
        isCurrent: true,
        rounds: [round({ id: "r1", selectionState: "FINALIZED" }), round({ id: "r2", selectionState: "DRAFT" })],
      },
    ];
    const vm = buildLeagueViewModel(periods);
    expect(vm.featureRound?.id).toBe("r2");
  });

  it("sums blocker and decision-required counts across all rounds in the active period", () => {
    const periods: LeaguePeriodInput[] = [
      {
        id: "p1",
        title: "Autumn 2026",
        isCurrent: true,
        rounds: [
          round({ id: "r1", blockerCount: 2, decisionRequiredCount: 1 }),
          round({ id: "r2", blockerCount: 0, decisionRequiredCount: 3 }),
        ],
      },
    ];
    const vm = buildLeagueViewModel(periods);
    expect(vm.totalBlockerCount).toBe(2);
    expect(vm.totalDecisionRequiredCount).toBe(4);
  });

  it("features no round at all when every round is already finalized (regression: previously fell back to rounds[0] regardless of state)", () => {
    const periods: LeaguePeriodInput[] = [
      {
        id: "p1",
        title: "Autumn 2026",
        isCurrent: true,
        rounds: [round({ id: "r1", selectionState: "FINALIZED" }), round({ id: "r2", selectionState: "FINALIZED" })],
      },
    ];
    const vm = buildLeagueViewModel(periods);
    expect(vm.featureRound).toBeNull();
    expect(vm.historyRounds.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("returns nulls when there are no periods at all", () => {
    const vm = buildLeagueViewModel([]);
    expect(vm.activePeriod).toBeNull();
    expect(vm.featureRound).toBeNull();
    expect(vm.historyRounds).toEqual([]);
  });
});
