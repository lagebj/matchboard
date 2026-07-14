import { describe, it, expect } from "vitest";
import type { WorkbenchFixture } from "../workbench-types";
import type { PolicySource } from "@/lib/policies/types";

describe("WorkbenchFixture type structure", () => {
  it("accepts a valid league fixture", () => {
    const fixture: WorkbenchFixture = {
      id: "test-league-fixture",
      label: "Test league fixture",
      description: "A test fixture for league match selection",
      decisionType: "league_match_selection",
      mode: "league",
      input: {
        context: {
          phase: "pre_selection",
          mode: "league",
          decisionType: "league_match_selection",
          fairnessScope: "match",
          nowIso: "2026-01-01T00:00:00Z",
        },
        players: [
          { id: "player_a", displayName: "Player A", status: "ACTIVE", availableForContext: true, currentTeamIds: ["team_home"] },
        ],
        teams: [
          { id: "team_home", name: "Home", targetSquadSize: 7, minSquadSize: 5, maxSquadSize: 9 },
        ],
        squads: [
          { id: "squad_1", teamId: "team_home", playerIdList: ["player_a"], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 0, anyGoalkeeperCount: 0 },
        ],
        matches: [
          { id: "match_1", isCancelled: false, opponentName: "Opponent", startsAt: "2026-01-01T10:00:00Z" },
        ],
        history: { playerMatchCountMap: {}, playerRoleMap: {}, playerRecentSupportCount: {} },
        constraints: {},
      },
    };

    expect(fixture.id).toBe("test-league-fixture");
    expect(fixture.mode).toBe("league");
    expect(fixture.decisionType).toBe("league_match_selection");
  });

  it("accepts a valid event fixture", () => {
    const fixture: WorkbenchFixture = {
      id: "test-event-fixture",
      label: "Test event fixture",
      description: "A test fixture for event squad generation",
      decisionType: "event_squad_generation",
      mode: "event",
      input: {
        context: {
          phase: "pre_selection",
          mode: "event",
          decisionType: "event_squad_generation",
          nowIso: "2026-01-01T00:00:00Z",
          eventId: "event_1",
        },
        players: [
          { id: "player_a", displayName: "Player A", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        ],
        teams: [],
        squads: [],
        matches: [],
        history: { playerMatchCountMap: {}, playerRoleMap: {}, playerRecentSupportCount: {} },
        constraints: {},
      },
    };

    expect(fixture.mode).toBe("event");
    expect(fixture.decisionType).toBe("event_squad_generation");
  });
});

describe("PolicySource type", () => {
  it("accepts all valid source values", () => {
    const sources: PolicySource[] = ["core", "default_policy", "rego", "solver", "validation"];

    expect(sources).toHaveLength(5);
    expect(sources).toContain("core");
    expect(sources).toContain("default_policy");
    expect(sources).toContain("rego");
    expect(sources).toContain("solver");
    expect(sources).toContain("validation");
  });
});