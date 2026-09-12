import { describe, it, expect } from "vitest";
import {
  INSIGHT_CARDS,
  INSIGHT_GROUP_ORDER,
  groupInsightCards,
  getGroupSpotlightValue,
} from "../get-insights-hub-groups";
import type { InsightOverview } from "@/lib/insights/insights-types";

function makeOverview(overrides: Partial<InsightOverview> = {}): InsightOverview {
  return {
    totalPlayers: 20,
    playersWithNoOpportunity: 3,
    playersWithHighLoad: 2,
    matchesWithMissingReports: 1,
    matchesWithCoverageWarnings: 0,
    policyWarningsCount: 4,
    plannedActualDeltasCount: 5,
    conflictsCount: 0,
    ...overrides,
  };
}

describe("groupInsightCards", () => {
  it("produces exactly the four groups in the spec's order", () => {
    const groups = groupInsightCards(INSIGHT_CARDS);
    expect(groups.map((g) => g.id)).toEqual(INSIGHT_GROUP_ORDER);
  });

  it("places every card into exactly one group, with none dropped", () => {
    const groups = groupInsightCards(INSIGHT_CARDS);
    const totalGrouped = groups.reduce((sum, g) => sum + g.cards.length, 0);
    expect(totalGrouped).toBe(INSIGHT_CARDS.length);
  });

  it("assigns Player Pathways to Roles & development, per the spec's own 'pathways' source", () => {
    const groups = groupInsightCards(INSIGHT_CARDS);
    const rolesGroup = groups.find((g) => g.id === "roles-development")!;
    expect(rolesGroup.cards.some((c) => c.id === "player-pathways")).toBe(true);
  });

  it("assigns Player Combinations to Match patterns, not Roles & development", () => {
    const groups = groupInsightCards(INSIGHT_CARDS);
    const matchGroup = groups.find((g) => g.id === "match-patterns")!;
    const rolesGroup = groups.find((g) => g.id === "roles-development")!;
    expect(matchGroup.cards.some((c) => c.id === "player-combinations")).toBe(true);
    expect(rolesGroup.cards.some((c) => c.id === "player-combinations")).toBe(false);
  });
});

describe("getGroupSpotlightValue", () => {
  it("returns null when no overview data is available yet", () => {
    expect(getGroupSpotlightValue("opportunity-load", null)).toBeNull();
  });

  it("maps 'Opportunity & load' to playersWithNoOpportunity", () => {
    const overview = makeOverview({ playersWithNoOpportunity: 7 });
    expect(getGroupSpotlightValue("opportunity-load", overview)).toEqual({
      label: "Players with no opportunity",
      title: "7 players have no planned opportunity",
      value: 7,
    });
  });

  it("uses singular phrasing for a value of exactly 1", () => {
    const overview = makeOverview({ playersWithNoOpportunity: 1 });
    expect(getGroupSpotlightValue("opportunity-load", overview)?.title).toBe("1 player has no planned opportunity");
  });

  it("maps 'Planning quality' to policyWarningsCount", () => {
    const overview = makeOverview({ policyWarningsCount: 9 });
    expect(getGroupSpotlightValue("planning-quality", overview)).toEqual({
      label: "Policy warnings",
      title: "9 active policy warnings",
      value: 9,
    });
  });

  it("returns null for 'Roles & development' and 'Match patterns' (no mapped overview field)", () => {
    const overview = makeOverview();
    expect(getGroupSpotlightValue("roles-development", overview)).toBeNull();
    expect(getGroupSpotlightValue("match-patterns", overview)).toBeNull();
  });
});
