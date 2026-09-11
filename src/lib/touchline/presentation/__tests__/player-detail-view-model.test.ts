import { describe, it, expect } from "vitest";
import {
  buildPlayerDetailViewModel,
  computePositionShare,
  describeOpportunityTrend,
  type PlayerDetailViewModelInput,
} from "../player-detail-view-model";

const baseInput: PlayerDetailViewModelInput = {
  identity: {
    playerId: "p1",
    firstName: "Noah",
    lastName: "Larsen",
    shirtNumber: 10,
    primaryPosition: "LW",
    coreTeamName: "Graabein United",
    groupLabel: "G2015 · Autumn 2026",
  },
  allTimeStats: { actualAppearances: 11, goals: 2, assists: 4 },
  recentOpportunity: null,
  realisedPositionCounts: {},
  outfieldRoles: [],
  activeDevelopmentFocus: null,
  latestObservations: [],
  recentMatches: [],
};

describe("computePositionShare", () => {
  it("computes rounded percentage shares sorted by count descending", () => {
    const shares = computePositionShare({ LW: 34, LM: 11, ST: 5 });
    expect(shares).toEqual([
      { code: "LW", count: 34, sharePercent: 68 },
      { code: "LM", count: 11, sharePercent: 22 },
      { code: "ST", count: 5, sharePercent: 10 },
    ]);
  });

  it("returns an empty array when there is no exposure data", () => {
    expect(computePositionShare({})).toEqual([]);
  });
});

describe("describeOpportunityTrend", () => {
  it("states plain involvement with no comparison when there is no previous period", () => {
    const text = describeOpportunityTrend({
      perRound: [],
      recentCount: 4,
      recentTotal: 5,
      previousCount: null,
      previousTotal: null,
    });
    expect(text).toBe("4 of the last 5 eligible rounds included a planned opportunity.");
    expect(text).not.toMatch(/because|caused|due to/i);
  });

  it("describes an increase without causal language", () => {
    const text = describeOpportunityTrend({
      perRound: [],
      recentCount: 5,
      recentTotal: 5,
      previousCount: 3,
      previousTotal: 5,
    });
    expect(text).toContain("more than the previous period");
    expect(text).not.toMatch(/because|caused|due to/i);
  });

  it("describes a decrease without causal language", () => {
    const text = describeOpportunityTrend({
      perRound: [],
      recentCount: 2,
      recentTotal: 5,
      previousCount: 4,
      previousTotal: 5,
    });
    expect(text).toContain("fewer than the previous period");
  });

  it("describes no change as consistent", () => {
    const text = describeOpportunityTrend({
      perRound: [],
      recentCount: 3,
      recentTotal: 5,
      previousCount: 3,
      previousTotal: 5,
    });
    expect(text).toContain("Consistent involvement");
  });
});

describe("buildPlayerDetailViewModel", () => {
  it("maps recent opportunity into a sparkline series and ratio label", () => {
    const vm = buildPlayerDetailViewModel({
      ...baseInput,
      recentOpportunity: {
        perRound: [
          { roundLabel: "W32", hadOpportunity: false },
          { roundLabel: "W33", hadOpportunity: true },
        ],
        recentCount: 1,
        recentTotal: 2,
        previousCount: null,
        previousTotal: null,
      },
    });
    expect(vm.opportunity).not.toBeNull();
    expect(vm.opportunity?.ratioLabel).toBe("1 / 2");
    expect(vm.opportunity?.sparkline).toEqual([0, 100]);
    expect(vm.opportunity?.periodLabels).toEqual(["W32", "W33"]);
  });

  it("returns null opportunity when none is supplied (never fabricated)", () => {
    const vm = buildPlayerDetailViewModel(baseInput);
    expect(vm.opportunity).toBeNull();
  });

  it("passes through participation stats unchanged", () => {
    const vm = buildPlayerDetailViewModel(baseInput);
    expect(vm.participation).toEqual({ matches: 11, goals: 2, assists: 4 });
  });
});
