import { describe, it, expect } from "vitest";
import {
  diffPolicyResults,
  summarizeInput,
} from "../policy-diff";
import type { SelectionPolicyResult } from "@/lib/policies/types";

function makePolicyResult(overrides?: Partial<SelectionPolicyResult>): SelectionPolicyResult {
  return {
    allowedPlayerIds: [],
    blocked: {},
    warnings: [],
    scoreAdjustments: [],
    explanations: [],
    tags: [],
    ...overrides,
  };
}

describe("diffPolicyResults", () => {
  it("returns empty diff when results are identical", () => {
    const result = makePolicyResult({
      allowedPlayerIds: ["p1"],
      blocked: {},
      warnings: [],
      scoreAdjustments: [],
      explanations: [],
    });

    const diff = diffPolicyResults(result, result);

    expect(diff.blockedAddedByRego).toEqual({});
    expect(diff.warningsAddedByRego).toEqual([]);
    expect(diff.scoreAdjustmentsAddedByRego).toEqual([]);
    expect(diff.explanationsAddedByRego).toEqual([]);
    expect(diff.validityChanged).toBe(false);
    expect(diff.wasValidDefaultOnly).toBe(true);
    expect(diff.isValidWithRego).toBe(true);
  });

  it("detects newly blocked players from Rego", () => {
    const defaultOnly = makePolicyResult({
      blocked: { p1: ["inactive_player"] },
    });
    const withRego = makePolicyResult({
      blocked: {
        p1: ["inactive_player"],
        p2: ["rego_extra_block"],
      },
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.blockedAddedByRego).toEqual({
      p2: ["rego_extra_block"],
    });
  });

  it("detects new blocking reasons for already-blocked players", () => {
    const defaultOnly = makePolicyResult({
      blocked: { p1: ["reason_a"] },
    });
    const withRego = makePolicyResult({
      blocked: { p1: ["reason_a", "rego_reason_b"] },
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.blockedAddedByRego).toEqual({
      p1: ["rego_reason_b"],
    });
  });

  it("ignores identical blocking reasons", () => {
    const defaultOnly = makePolicyResult({
      blocked: { p1: ["reason_a", "reason_b"] },
    });
    const withRego = makePolicyResult({
      blocked: { p1: ["reason_a", "reason_b"] },
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.blockedAddedByRego).toEqual({});
  });

  it("detects warnings added by Rego", () => {
    const defaultOnly = makePolicyResult({
      warnings: [
        { code: "w1", severity: "warning", message: "Default warning", playerId: "p1", teamId: undefined, matchId: undefined, source: "default_policy" },
      ],
    });
    const withRego = makePolicyResult({
      warnings: [
        { code: "w1", severity: "warning", message: "Default warning", playerId: "p1", teamId: undefined, matchId: undefined, source: "default_policy" },
        { code: "rego_w1", severity: "blocking", message: "Rego warning", playerId: "p2", teamId: undefined, matchId: undefined, source: "rego" },
      ],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.warningsAddedByRego).toHaveLength(1);
    expect(diff.warningsAddedByRego[0].code).toBe("rego_w1");
  });

  it("detects score adjustments added by Rego", () => {
    const defaultOnly = makePolicyResult({
      scoreAdjustments: [
        { playerId: "p1", delta: 5, reason: "Low matches", code: "low_recent_match_count", source: "default_policy" },
      ],
    });
    const withRego = makePolicyResult({
      scoreAdjustments: [
        { playerId: "p1", delta: 5, reason: "Low matches", code: "low_recent_match_count", source: "default_policy" },
        { playerId: "p2", delta: -3, reason: "Rego penalty", code: "rego_penalty", source: "rego" },
      ],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.scoreAdjustmentsAddedByRego).toHaveLength(1);
    expect(diff.scoreAdjustmentsAddedByRego[0].playerId).toBe("p2");
    expect(diff.scoreAdjustmentsAddedByRego[0].delta).toBe(-3);
  });

  it("detects explanations added by Rego", () => {
    const defaultOnly = makePolicyResult({
      explanations: [
        { playerId: "p1", code: "eligible", summary: "Eligible player", hardRule: false, source: "default_policy" },
      ],
    });
    const withRego = makePolicyResult({
      explanations: [
        { playerId: "p1", code: "eligible", summary: "Eligible player", hardRule: false, source: "default_policy" },
        { playerId: "p2", code: "rego_explain", summary: "Rego explanation", hardRule: true, source: "rego" },
      ],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.explanationsAddedByRego).toHaveLength(1);
    expect(diff.explanationsAddedByRego[0].playerId).toBe("p2");
    expect(diff.explanationsAddedByRego[0].code).toBe("rego_explain");
  });

  it("detects validity change from blocking Rego rules", () => {
    const defaultOnly = makePolicyResult({
      warnings: [
        { code: "w1", severity: "warning", message: "Not blocking", playerId: undefined, teamId: undefined, matchId: undefined, source: "default_policy" },
      ],
    });
    const withRego = makePolicyResult({
      warnings: [
        { code: "w1", severity: "warning", message: "Not blocking", playerId: undefined, teamId: undefined, matchId: undefined, source: "default_policy" },
        { code: "rego_block", severity: "blocking", message: "Rego blocks", playerId: "p1", teamId: undefined, matchId: undefined, source: "rego" },
      ],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.wasValidDefaultOnly).toBe(true);
    expect(diff.isValidWithRego).toBe(false);
    expect(diff.validityChanged).toBe(true);
  });

  it("reports no validity change when both are valid", () => {
    const defaultOnly = makePolicyResult({
      warnings: [{ code: "w1", severity: "info", message: "Info", playerId: undefined, teamId: undefined, matchId: undefined, source: "default_policy" }],
    });
    const withRego = makePolicyResult({
      warnings: [{ code: "w1", severity: "info", message: "Info", playerId: undefined, teamId: undefined, matchId: undefined, source: "default_policy" }],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.wasValidDefaultOnly).toBe(true);
    expect(diff.isValidWithRego).toBe(true);
    expect(diff.validityChanged).toBe(false);
  });

  it("reports no validity change when both are invalid", () => {
    const defaultOnly = makePolicyResult({
      warnings: [{ code: "w1", severity: "blocking", message: "Blocked", playerId: undefined, teamId: undefined, matchId: undefined, source: "core" }],
    });
    const withRego = makePolicyResult({
      warnings: [
        { code: "w1", severity: "blocking", message: "Blocked", playerId: undefined, teamId: undefined, matchId: undefined, source: "core" },
        { code: "rego_b", severity: "blocking", message: "Also blocked", playerId: "p2", teamId: undefined, matchId: undefined, source: "rego" },
      ],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.wasValidDefaultOnly).toBe(false);
    expect(diff.isValidWithRego).toBe(false);
    expect(diff.validityChanged).toBe(false);
  });

  it("detects validity change when Rego resolves blocking", () => {
    const defaultOnly = makePolicyResult({
      warnings: [{ code: "w1", severity: "blocking", message: "Blocked", playerId: undefined, teamId: undefined, matchId: undefined, source: "core" }],
    });
    const withRego = makePolicyResult({
      warnings: [],
    });

    const diff = diffPolicyResults(defaultOnly, withRego);

    expect(diff.wasValidDefaultOnly).toBe(false);
    expect(diff.isValidWithRego).toBe(true);
    expect(diff.validityChanged).toBe(true);
  });
});

describe("summarizeInput", () => {
  it("counts players, teams, squads, and matches", () => {
    const summary = summarizeInput({
      players: [
        { id: "p1", availableForContext: true, status: "ACTIVE" },
        { id: "p2", availableForContext: true, status: "ACTIVE" },
        { id: "p3", availableForContext: false, status: "ACTIVE" },
        { id: "p4", availableForContext: false, status: "REMOVED" },
      ],
      teams: [{ id: "t1" }, { id: "t2" }],
      squads: [{ id: "s1", playerIdList: ["p1", "p2"] }, { id: "s2", playerIdList: [] }],
      matches: [
        { id: "m1", isCancelled: false },
        { id: "m2", isCancelled: true },
      ],
      context: { mode: "league", decisionType: "league_match_selection" },
    });

    expect(summary.playerCount).toBe(4);
    expect(summary.teamCount).toBe(2);
    expect(summary.squadCount).toBe(2);
    expect(summary.matchCount).toBe(1);
    expect(summary.availablePlayerCount).toBe(2);
    expect(summary.contextMode).toBe("league");
    expect(summary.decisionType).toBe("league_match_selection");
  });

  it("handles empty input", () => {
    const summary = summarizeInput({
      players: [],
      teams: [],
      squads: [],
      matches: [],
      context: { mode: "event", decisionType: "event_squad_generation" },
    });

    expect(summary.playerCount).toBe(0);
    expect(summary.availablePlayerCount).toBe(0);
    expect(summary.matchCount).toBe(0);
  });

  it("passes through fairnessScope and generationMode", () => {
    const summary = summarizeInput({
      players: [],
      teams: [],
      squads: [],
      matches: [],
      context: {
        mode: "league",
        decisionType: "league_round_fairness",
        fairnessScope: "round",
        generationMode: "populate_all",
      },
    });

    expect(summary.fairnessScope).toBe("round");
    expect(summary.generationMode).toBe("populate_all");
  });
});