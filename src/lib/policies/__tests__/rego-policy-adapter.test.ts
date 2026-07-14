import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SelectionPolicyInput } from "../types";

vi.mock("@open-policy-agent/opa-wasm", () => ({
  loadPolicy: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("mock-wasm-content")),
  };
});

import { RegoPolicyAdapter, RegoPolicyError, clearRegoPolicyCache, isRegoEnabled, getRegoFailureMode } from "../rego-policy-adapter";
import { loadPolicy } from "@open-policy-agent/opa-wasm";

const mockInput: SelectionPolicyInput = {
  context: {
    phase: "pre_selection",
    mode: "event",
    nowIso: "2026-01-01T00:00:00Z",
    gameFormat: "7v7",
  },
  players: [
    {
      id: "p1",
      displayName: "Active Player",
      status: "ACTIVE",
      availableForContext: true,
      primaryPosition: "MIDFIELDER",
      goalkeeperAbility: "NO",
      recentMatchCount: 0,
      seasonMatchCount: 2,
      periodMatchCount: 1,
      currentTeamIds: ["t1"],
    },
    {
      id: "p2",
      displayName: "Inactive Player",
      status: "INACTIVE",
      availableForContext: false,
      primaryPosition: "DEFENDER",
      goalkeeperAbility: "NO",
      recentMatchCount: 0,
      seasonMatchCount: 0,
      periodMatchCount: 0,
      currentTeamIds: ["t1"],
    },
  ],
  teams: [
    { id: "t1", name: "Team A", targetSquadSize: 7, minSquadSize: 5, maxSquadSize: 9 },
  ],
  squads: [
    {
      id: "s1",
      teamId: "t1",
      name: "Squad 1",
      playerIdList: ["p1"],
      primaryGoalkeeperCount: 0,
      anyGoalkeeperCount: 0,
    },
  ],
  matches: [{ id: "m1", isCancelled: false }],
  history: {
    playerMatchCountMap: {},
    playerRoleMap: {},
    playerRecentSupportCount: {},
  },
  constraints: {
    maxSquadSize: 9,
    minSquadSize: 5,
    targetSquadSize: 7,
    requireGoalkeeper: true,
  },
};

function createMockPolicy(evaluateFn: (input: unknown) => unknown[]) {
  return { evaluate: evaluateFn };
}

describe("RegoPolicyAdapter", () => {
  beforeEach(() => {
    clearRegoPolicyCache();
    vi.clearAllMocks();
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE = "fail_closed";
  });

  it("returns empty result when Rego is disabled", async () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "false";
    const adapter = new RegoPolicyAdapter();
    const result = await adapter.evaluate(mockInput);
    expect(result.allowedPlayerIds).toEqual(["p1", "p2"]);
    expect(result.blocked).toEqual({});
    expect(result.warnings).toEqual([]);
    expect(result.scoreAdjustments).toEqual([]);
  });

  it("evaluates a Rego policy with score adjustments", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [],
          warnings: [],
          score_adjustments: [
            {
              player_id: "p1",
              delta: 5,
              reason: "Player has had fewer recent match opportunities.",
              code: "rego_low_recent_match_count",
            },
          ],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(result.scoreAdjustments).toHaveLength(1);
    expect(result.scoreAdjustments[0].playerId).toBe("p1");
    expect(result.scoreAdjustments[0].delta).toBe(5);
    expect(result.scoreAdjustments[0].code).toBe("rego_low_recent_match_count");
    expect(result.allowedPlayerIds).toContain("p1");
  });

  it("evaluates a Rego policy with warnings", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [],
          warnings: [
            {
              code: "rego_no_primary_goalkeeper",
              severity: "blocking",
              message: "Squad has no goalkeeper coverage at all.",
              team_id: "t1",
            },
          ],
          score_adjustments: [],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("rego_no_primary_goalkeeper");
    expect(result.warnings[0].severity).toBe("blocking");
    expect(result.warnings[0].teamId).toBe("t1");
  });

  it("evaluates a Rego policy with blocked players", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [
            {
              player_id: "p-tagged",
              reasons: ["blocked_by_custom_policy_tag"],
            },
          ],
          warnings: [],
          score_adjustments: [],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(Object.keys(result.blocked)).toHaveLength(1);
    expect(result.blocked["p-tagged"]).toContain("blocked_by_custom_policy_tag");
    expect(result.allowedPlayerIds).not.toContain("p-tagged");
  });

  it("clamps score adjustments to ±20 bounds", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [],
          warnings: [],
          score_adjustments: [
            { player_id: "p1", delta: 50, reason: "Extreme boost", code: "extreme" },
            { player_id: "p2", delta: -50, reason: "Extreme penalty", code: "extreme_pen" },
          ],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(result.scoreAdjustments).toHaveLength(2);
    expect(result.scoreAdjustments.find((a) => a.playerId === "p1")!.delta).toBe(20);
    expect(result.scoreAdjustments.find((a) => a.playerId === "p2")!.delta).toBe(-20);
  });

  it("normalizes severity to valid values", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [],
          warnings: [
            { code: "w1", severity: "blocking", message: "blocking" },
            { code: "w2", severity: "warning", message: "warning" },
            { code: "w3", severity: "info", message: "info" },
            { code: "w4", severity: "invalid_severity", message: "fallback" },
          ],
          score_adjustments: [],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(result.warnings).toHaveLength(4);
    expect(result.warnings[0].severity).toBe("blocking");
    expect(result.warnings[1].severity).toBe("warning");
    expect(result.warnings[2].severity).toBe("info");
    expect(result.warnings[3].severity).toBe("warning");
  });

  it("handles missing/invalid Rego result gracefully in fail_closed mode", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => []);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    await expect(adapter.evaluate(mockInput)).rejects.toThrow(RegoPolicyError);
  });

  it("returns empty result in fail_open mode when evaluation fails", async () => {
    process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE = "fail_open";

    vi.mocked(loadPolicy).mockRejectedValue(new Error("Wasm load failed"));

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    const result = await adapter.evaluate(mockInput);

    expect(result.allowedPlayerIds).toEqual(["p1", "p2"]);
    expect(result.blocked).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it("caches the loaded policy module", async () => {
    const mockPolicy = createMockPolicy((_input: unknown) => [
      {
        result: {
          blocked: [],
          warnings: [],
          score_adjustments: [],
          explanations: [],
          tags: [],
        },
      },
    ]);

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    await adapter.evaluate(mockInput);
    await adapter.evaluate(mockInput);

    expect(loadPolicy).toHaveBeenCalledTimes(1);
  });

  it("transforms input to snake_case for Rego", async () => {
    let capturedInput: unknown = null;
    const mockPolicy = createMockPolicy((input: unknown) => {
      capturedInput = input;
      return [
        {
          result: {
            blocked: [],
            warnings: [],
            score_adjustments: [],
            explanations: [],
            tags: [],
          },
        },
      ];
    });

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    await adapter.evaluate(mockInput);

    expect(capturedInput).not.toBeNull();
    const input = capturedInput as Record<string, unknown>;
    expect(input).toHaveProperty("players");
    const players = input.players as Record<string, unknown>[];
    expect(players[0]).toHaveProperty("display_name");
    expect(players[0]).toHaveProperty("available_for_context");
    expect(players[0]).toHaveProperty("recent_match_count");
  });

  it("passes policyTags in player data for Rego consumption", async () => {
    const inputWithTags: SelectionPolicyInput = {
      ...mockInput,
      players: [
        {
          ...mockInput.players[0],
          policyTags: ["custom_blocked"],
        } as Record<string, unknown> & typeof mockInput.players[0],
      ],
    };

    let capturedInput: unknown = null;
    const mockPolicy = createMockPolicy((input: unknown) => {
      capturedInput = input;
      return [
        {
          result: {
            blocked: [],
            warnings: [],
            score_adjustments: [],
            explanations: [],
            tags: [],
          },
        },
      ];
    });

    vi.mocked(loadPolicy).mockResolvedValue(mockPolicy as never);

    const adapter = new RegoPolicyAdapter({ wasmPath: "/mock/policy.wasm" });
    await adapter.evaluate(inputWithTags);

    const input = capturedInput as Record<string, unknown>;
    const players = input.players as Record<string, unknown>[];
    expect(players[0]).toHaveProperty("policy_tags");
    expect((players[0] as Record<string, unknown>).policy_tags).toEqual(["custom_blocked"]);
  });
});

describe("isRegoEnabled", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true when MATCHBOARD_POLICY_REGO_ENABLED is true", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    expect(isRegoEnabled()).toBe(true);
  });

  it("returns false by default", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_ENABLED;
    expect(isRegoEnabled()).toBe(false);
  });
});

describe("getRegoFailureMode", () => {
  it("returns fail_closed by default", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE;
    expect(getRegoFailureMode()).toBe("fail_closed");
  });

  it("returns fail_open when set", () => {
    process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE = "fail_open";
    expect(getRegoFailureMode()).toBe("fail_open");
  });
});