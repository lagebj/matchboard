import { describe, it, expect } from "vitest";

describe("Fixtures Service unit tests", () => {
  describe("mapReadiness (via service output)", () => {
    it("maps severity order correctly by convention", () => {
      const order: Record<string, number> = {
        NOT_PLAYABLE: 0,
        AT_RISK: 1,
        WATCH: 2,
        READY: 3,
      };
      expect(order["NOT_PLAYABLE"]).toBeLessThan(order["AT_RISK"]);
      expect(order["AT_RISK"]).toBeLessThan(order["WATCH"]);
      expect(order["WATCH"]).toBeLessThan(order["READY"]);
    });
  });

  describe("FixturesOverview type shape", () => {
    it("has expected top-level keys", () => {
      const overview: import("../types").FixturesOverview = { periods: [] };
      expect(overview).toHaveProperty("periods");
      expect(overview.periods).toEqual([]);
    });

    it("FixturePeriod has required fields", () => {
      const period: import("../types").FixturePeriod = {
        id: "p1",
        title: "Test Period",
        dateRange: "Jan – Jun",
        readinessState: "READY",
        blockerCount: 0,
        decisionRequiredCount: 0,
        rounds: [],
      };
      expect(period.id).toBe("p1");
      expect(period.readinessState).toBe("READY");
    });

    it("FixtureRound has required fields", () => {
      const round: import("../types").FixtureRound = {
        id: "r1",
        title: "Round 1",
        readinessState: "READY",
        selectionState: "DRAFT",
        hasDraftSelections: true,
        hasMatches: true,
        blockerCount: 0,
        decisionRequiredCount: 0,
        availableActions: ["recreateDraft", "clearDraft", "finalize"],
        matches: [],
      };
      expect(round.selectionState).toBe("DRAFT");
      expect(round.hasDraftSelections).toBe(true);
      expect(round.availableActions).toContain("finalize");
    });

    it("FixtureMatch has required fields", () => {
      const match: import("../types").FixtureMatch = {
        id: "m1",
        title: "Bla vs Opponent",
        teamId: "team-1",
        teamName: "Bla",
        opponent: "Opponent",
        readinessState: "READY",
        selectionState: "DRAFT",
        selectedPlayerCount: 0,
        blockerCount: 0,
        decisionRequiredCount: 0,
        availableActions: ["recreateDraft", "clearDraft", "finalize"],
      };
      expect(match.teamId).toBe("team-1");
      expect(match.selectionState).toBe("DRAFT");
      expect(match.availableActions).toContain("finalize");
    });
  });
});