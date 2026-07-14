import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateConditionGroup,
  evaluatePolicyPack,
} from "../json-policy-dsl";
import type { PolicyPack, PolicyConditionGroup, SelectionPolicyInput } from "../types";

function makeInput(overrides?: Partial<SelectionPolicyInput>): SelectionPolicyInput {
  return {
    context: {
      phase: "pre_selection",
      mode: "event",
      nowIso: "2026-01-01T00:00:00Z",
    },
    players: [],
    teams: [],
    squads: [],
    matches: [],
    history: { playerMatchCountMap: {}, playerRoleMap: {}, playerRecentSupportCount: {} },
    constraints: {},
    ...overrides,
  };
}

describe("evaluateCondition", () => {
  const ctx = { player: { status: "ACTIVE" as const, recentMatchCount: 3, primaryPosition: "CM" } };

  it("eq matches", () => {
    expect(evaluateCondition({ field: "player.status", op: "eq" as const, value: "ACTIVE" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.status", op: "eq" as const, value: "REMOVED" }, ctx)).toBe(false);
  });

  it("neq matches", () => {
    expect(evaluateCondition({ field: "player.status", op: "neq" as const, value: "REMOVED" }, ctx)).toBe(true);
  });

  it("lt/lte/gt/gte work", () => {
    expect(evaluateCondition({ field: "player.recentMatchCount", op: "lt" as const, value: 5 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.recentMatchCount", op: "lte" as const, value: 3 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.recentMatchCount", op: "gt" as const, value: 2 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.recentMatchCount", op: "gte" as const, value: 3 }, ctx)).toBe(true);
  });

  it("in/not_in work", () => {
    expect(evaluateCondition({ field: "player.primaryPosition", op: "in" as const, values: ["CM", "CB"] }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.primaryPosition", op: "not_in" as const, values: ["ST", "GK"] }, ctx)).toBe(true);
  });

  it("exists/not_exists work", () => {
    expect(evaluateCondition({ field: "player.status", op: "exists" as const }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "player.nonexistent", op: "not_exists" as const }, ctx)).toBe(true);
  });

  it("contains works", () => {
    const ctxWithStr = { player: { displayName: "John Smith" } };
    expect(evaluateCondition({ field: "player.displayName", op: "contains" as const, value: "Smith" }, ctxWithStr)).toBe(true);
  });
});

describe("evaluateConditionGroup", () => {
  it("all requires all conditions true", () => {
    const group: PolicyConditionGroup = {
      all: [
        { field: "player.status", op: "eq", value: "ACTIVE" },
        { field: "player.recentMatchCount", op: "gte", value: 3 },
      ],
    };
    expect(evaluateConditionGroup(group, { player: { status: "ACTIVE", recentMatchCount: 3 } })).toBe(true);
    expect(evaluateConditionGroup(group, { player: { status: "ACTIVE", recentMatchCount: 1 } })).toBe(false);
  });

  it("any requires at least one condition true", () => {
    const group: PolicyConditionGroup = {
      any: [
        { field: "player.status", op: "eq", value: "REMOVED" },
        { field: "player.status", op: "eq", value: "ACTIVE" },
      ],
    };
    expect(evaluateConditionGroup(group, { player: { status: "ACTIVE" } })).toBe(true);
    expect(evaluateConditionGroup(group, { player: { status: "INACTIVE" } })).toBe(false);
  });

  it("empty group returns true", () => {
    expect(evaluateConditionGroup({}, {})).toBe(true);
  });
});

describe("evaluatePolicyPack", () => {
  const denyPack: PolicyPack = {
    id: "test-deny",
    name: "Test Deny",
    version: "1.0.0",
    rules: [
      {
        id: "deny-removed",
        effect: "deny",
        when: { all: [{ field: "player.status", op: "eq", value: "REMOVED" }] },
        reason: "Removed players cannot be selected.",
      },
    ],
  };

  it("denies removed players", () => {
    const result = evaluatePolicyPack(denyPack, makeInput({
      players: [
        { id: "p1", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
        { id: "p2", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
      ],
    }));
    expect(result.blocked["p1"]).toContain("deny-removed");
    expect(result.blocked["p2"]).toBeUndefined();
    expect(result.allowedPlayerIds).toContain("p2");
    expect(result.allowedPlayerIds).not.toContain("p1");
  });

  it("produces warnings", () => {
    const warnPack: PolicyPack = {
      id: "test-warn",
      name: "Test Warn",
      version: "1.0.0",
      rules: [
        {
          id: "warn-no-gk",
          effect: "warning",
          when: { all: [{ field: "squad.primaryGoalkeeperCount", op: "eq", value: 0 }] },
          warning: { code: "no_gk", severity: "warning", message: "No goalkeeper." },
        },
      ],
    };
    const result = evaluatePolicyPack(warnPack, makeInput({
      squads: [{ id: "s1", primaryGoalkeeperCount: 0, anyGoalkeeperCount: 0, playerIdList: [] }],
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("no_gk");
  });

  it("produces score adjustments", () => {
    const scorePack: PolicyPack = {
      id: "test-score",
      name: "Test Score",
      version: "1.0.0",
      rules: [
        {
          id: "boost-low-count",
          effect: "score_adjustment",
          when: { all: [{ field: "player.recentMatchCount", op: "lte", value: 1 }] },
          scoreAdjustment: 5,
          reason: "Low recent match count.",
        },
      ],
    };
    const result = evaluatePolicyPack(scorePack, makeInput({
      players: [
        { id: "p1", displayName: "Low", status: "ACTIVE", availableForContext: true, recentMatchCount: 0, currentTeamIds: [] },
        { id: "p2", displayName: "High", status: "ACTIVE", availableForContext: true, recentMatchCount: 10, currentTeamIds: [] },
      ],
    }));
    expect(result.scoreAdjustments).toHaveLength(1);
    expect(result.scoreAdjustments[0].playerId).toBe("p1");
    expect(result.scoreAdjustments[0].delta).toBe(5);
  });

  it("produces tags", () => {
    const tagPack: PolicyPack = {
      id: "test-tag",
      name: "Test Tag",
      version: "1.0.0",
      rules: [
        {
          id: "tag-low-activity",
          effect: "tag",
          when: { all: [{ field: "player.seasonMatchCount", op: "lte", value: 2 }] },
          tag: "low_activity",
          reason: "Low season activity.",
        },
      ],
    };
    const result = evaluatePolicyPack(tagPack, makeInput({
      players: [
        { id: "p1", displayName: "Low", status: "ACTIVE", availableForContext: true, seasonMatchCount: 1, currentTeamIds: [] },
      ],
    }));
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].tag).toBe("low_activity");
  });
});
