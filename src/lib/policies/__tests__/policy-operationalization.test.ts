import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateSelectionPolicy,
  filterBlockedPlayerIds,
  applyScoreAdjustments,
  coachFacingBlockedReason,
  coachFacingWarningMessage,
  summarizePolicyResult,
  policyBlockedReasonsForPlayer,
  policyWarningsForPlayer,
  policyWarningsForTeam,
  mapPolicyWarningToCategory,
} from "../policy-evaluation";
import {
  policyBlockedToSignals,
  policyWarningsToSignals,
  mergePolicySignals,
  type PolicyDerivedSignal,
} from "../policy-signal-mapper";
import type { SelectionPolicyInput, PolicyWarning } from "../types";

const baseInput: SelectionPolicyInput = {
  context: { phase: "pre_selection", mode: "event", decisionType: "event_squad_generation", nowIso: "2026-01-01T00:00:00Z" },
  players: [
    { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: ["t1"] },
    { id: "p2", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
    { id: "p3", displayName: "Inactive", status: "INACTIVE", availableForContext: false, currentTeamIds: ["t1"] },
  ],
  teams: [{ id: "t1", name: "Team 1", targetSquadSize: 7, minSquadSize: 5, maxSquadSize: 9 }],
  squads: [{ id: "s1", teamId: "t1", name: "Squad 1", playerIdList: ["p1"], primaryGoalkeeperCount: 0, secondaryGoalkeeperCount: 0, anyGoalkeeperCount: 0 }],
  matches: [{ id: "m1", isCancelled: false }],
  history: { playerMatchCountMap: {}, playerRoleMap: {}, playerRecentSupportCount: {} },
  constraints: { maxSquadSize: 9, minSquadSize: 5, targetSquadSize: 7 },
};

describe("evaluateSelectionPolicy", () => {
  beforeEach(() => {
    vi.stubEnv("MATCHBOARD_POLICY_REGO_ENABLED", "false");
  });

  it("evaluates default policy with core invariants", async () => {
    const result = await evaluateSelectionPolicy(baseInput);
    expect(result.result.blocked).toHaveProperty("p2");
    expect(result.result.blocked).toHaveProperty("p3");
    expect(result.result.allowedPlayerIds).toContain("p1");
    expect(result.result.allowedPlayerIds).not.toContain("p2");
    expect(result.result.allowedPlayerIds).not.toContain("p3");
    expect(result.regoEnabled).toBe(false);
    expect(result.evaluationDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("includes policy version info", async () => {
    const result = await evaluateSelectionPolicy(baseInput);
    expect(result.regoFailureMode).toBe("fail_closed");
    expect(typeof result.evaluationDurationMs).toBe("number");
  });
});

describe("filterBlockedPlayerIds", () => {
  it("removes blocked player IDs from a list", () => {
    const result = {
      allowedPlayerIds: ["p1"],
      blocked: { p2: ["removed"], p3: ["inactive"] },
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const filtered = filterBlockedPlayerIds(["p1", "p2", "p3"], result);
    expect(filtered).toEqual(["p1"]);
  });

  it("returns all IDs when no blocks", () => {
    const result = {
      allowedPlayerIds: ["p1", "p2"],
      blocked: {},
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const filtered = filterBlockedPlayerIds(["p1", "p2"], result);
    expect(filtered).toEqual(["p1", "p2"]);
  });
});

describe("applyScoreAdjustments", () => {
  it("applies adjustments within bounds", () => {
    const scores = { p1: 10, p2: 5 };
    const adjustments = [
      { playerId: "p1", delta: 3, reason: "Low recent matches", code: "low_recent" },
      { playerId: "p2", delta: -2, reason: "High recent matches", code: "high_recent" },
    ];
    const result = applyScoreAdjustments(scores, adjustments);
    expect(result.p1).toBe(13);
    expect(result.p2).toBe(3);
  });

  it("clamps adjustments to ±20", () => {
    const scores = { p1: 10 };
    const adjustments = [
      { playerId: "p1", delta: 50, reason: "Extreme", code: "extreme" },
    ];
    const result = applyScoreAdjustments(scores, adjustments);
    expect(result.p1).toBe(30);
  });

  it("clamps negative adjustments to -20", () => {
    const scores = { p1: 10 };
    const adjustments = [
      { playerId: "p1", delta: -50, reason: "Extreme negative", code: "extreme_neg" },
    ];
    const result = applyScoreAdjustments(scores, adjustments);
    expect(result.p1).toBe(-10);
  });
});

describe("coachFacingBlockedReason", () => {
  it("returns human-readable reason for known codes", () => {
    expect(coachFacingBlockedReason("removed_player_cannot_be_selected")).toBe("Player is no longer in the active registry.");
    expect(coachFacingBlockedReason("inactive_player_cannot_be_selected")).toBe("Player is currently inactive.");
    expect(coachFacingBlockedReason("unavailable_player_cannot_be_selected")).toBe("Player is unavailable for this match.");
  });

  it("returns formatted code for unknown codes", () => {
    expect(coachFacingBlockedReason("custom_policy_rule")).toBe("Custom policy rule");
  });
});

describe("coachFacingWarningMessage", () => {
  it("returns the warning message", () => {
    const warning: PolicyWarning = {
      code: "no_primary_goalkeeper",
      severity: "blocking",
      message: "Squad has no primary goalkeeper coverage.",
    };
    expect(coachFacingWarningMessage(warning)).toBe("Squad has no primary goalkeeper coverage.");
  });
});

describe("summarizePolicyResult", () => {
  it("summarizes a policy result", () => {
    const result = {
      allowedPlayerIds: ["p1"],
      blocked: { p2: ["removed"], p3: ["inactive"] },
      warnings: [
        { code: "no_goalkeeper_coverage", severity: "blocking" as const, message: "No GK" },
      ],
      scoreAdjustments: [
        { playerId: "p1", delta: 5, reason: "Low matches", code: "low_recent" },
      ],
      explanations: [],
      tags: [],
    };
    const summary = summarizePolicyResult(result);
    expect(summary.blockedPlayerIds).toEqual(["p2", "p3"]);
    expect(summary.blockedReasons).toEqual({ p2: ["removed"], p3: ["inactive"] });
    expect(summary.warningCodes).toEqual(["no_goalkeeper_coverage"]);
    expect(summary.scoreAdjustmentCount).toBe(1);
    expect(summary.explanationCount).toBe(0);
  });
});

describe("policyBlockedReasonsForPlayer", () => {
  it("returns reasons for a blocked player", () => {
    const result = {
      allowedPlayerIds: [],
      blocked: { p1: ["removed", "custom_rule"] },
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    expect(policyBlockedReasonsForPlayer("p1", result)).toEqual(["removed", "custom_rule"]);
  });

  it("returns empty array for unblocked player", () => {
    const result = {
      allowedPlayerIds: ["p1"],
      blocked: {},
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    expect(policyBlockedReasonsForPlayer("p1", result)).toEqual([]);
  });
});

describe("policyWarningsForPlayer", () => {
  it("filters warnings for a specific player", () => {
    const result = {
      allowedPlayerIds: ["p1"],
      blocked: {},
      warnings: [
        { code: "w1", severity: "warning" as const, message: "m1", playerId: "p1" },
        { code: "w2", severity: "info" as const, message: "m2", playerId: "p2" },
      ],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const warnings = policyWarningsForPlayer("p1", result);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("w1");
  });
});

describe("policyWarningsForTeam", () => {
  it("filters warnings for a specific team", () => {
    const result = {
      allowedPlayerIds: [],
      blocked: {},
      warnings: [
        { code: "gk_warn", severity: "blocking" as const, message: "No GK", teamId: "t1" },
        { code: "squad_warn", severity: "warning" as const, message: "Small squad", teamId: "t2" },
      ],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const warnings = policyWarningsForTeam("t1", result);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("gk_warn");
  });
});

describe("mapPolicyWarningToCategory", () => {
  it("maps blocking severity to BLOCKED", () => {
    expect(mapPolicyWarningToCategory({ severity: "blocking", code: "test", message: "test" })).toBe("BLOCKED");
  });

  it("maps warning severity to DECISION_REQUIRED", () => {
    expect(mapPolicyWarningToCategory({ severity: "warning", code: "test", message: "test" })).toBe("DECISION_REQUIRED");
  });

  it("maps info severity to PLANNING_NOTE", () => {
    expect(mapPolicyWarningToCategory({ severity: "info", code: "test", message: "test" })).toBe("PLANNING_NOTE");
  });
});

describe("policyBlockedToSignals", () => {
  it("converts blocked players to signals", () => {
    const result = {
      allowedPlayerIds: [],
      blocked: { p1: ["removed_player_cannot_be_selected"], p2: ["inactive_player_cannot_be_selected"] },
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const signals = policyBlockedToSignals(result, "round-1");
    expect(signals).toHaveLength(2);
    expect(signals[0].kind).toBe("BLOCKED");
    expect(signals[0].ruleCode).toBe("removed_player_cannot_be_selected");
    expect(signals[0].playerId).toBe("p1");
    expect(signals[0].source).toBe("policy");
  });
});

describe("policyWarningsToSignals", () => {
  it("converts warnings to signals with correct categories", () => {
    const result = {
      allowedPlayerIds: [],
      blocked: {},
      warnings: [
        { code: "no_primary_goalkeeper", severity: "blocking" as const, message: "No GK", teamId: "t1" },
        { code: "low_recent_match", severity: "info" as const, message: "Low matches", playerId: "p1" },
      ],
      scoreAdjustments: [],
      explanations: [],
      tags: [],
    };
    const signals = policyWarningsToSignals(result, "round-1");
    expect(signals).toHaveLength(2);
    expect(signals[0].kind).toBe("BLOCKED");
    expect(signals[1].kind).toBe("PLANNING_NOTE");
  });
});

describe("mergePolicySignals", () => {
  it("deduplicates by idempotencyKey", () => {
    const existing: PolicyDerivedSignal[] = [
      { idempotencyKey: "existing-1", kind: "BLOCKED", ruleCode: "r1", title: "t1", detail: "d1", source: "policy" },
    ];
    const newSignals: PolicyDerivedSignal[] = [
      { idempotencyKey: "existing-1", kind: "BLOCKED", ruleCode: "r1", title: "t1", detail: "d1", source: "policy" },
      { idempotencyKey: "new-1", kind: "DECISION_REQUIRED", ruleCode: "r2", title: "t2", detail: "d2", source: "policy" },
    ];
    const merged = mergePolicySignals(existing, newSignals);
    expect(merged).toHaveLength(2);
  });

  it("adds all new signals when no duplicates", () => {
    const existing: PolicyDerivedSignal[] = [
      { idempotencyKey: "existing-1", kind: "BLOCKED", ruleCode: "r1", title: "t1", detail: "d1", source: "policy" },
    ];
    const newSignals: PolicyDerivedSignal[] = [
      { idempotencyKey: "new-1", kind: "DECISION_REQUIRED", ruleCode: "r2", title: "t2", detail: "d2", source: "policy" },
      { idempotencyKey: "new-2", kind: "PLANNING_NOTE", ruleCode: "r3", title: "t3", detail: "d3", source: "policy" },
    ];
    const merged = mergePolicySignals(existing, newSignals);
    expect(merged).toHaveLength(3);
  });
});