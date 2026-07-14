import { describe, it, expect } from "vitest";
import {
  DefaultMatchboardPolicyAdapter,
  CompositePolicyAdapter,
  createPolicyPipeline,
} from "../selection-policy-adapter";
import type { SelectionPolicyInput } from "../types";

function makeInput(overrides?: Partial<SelectionPolicyInput>): SelectionPolicyInput {
  return {
    context: {
      phase: "pre_selection",
      mode: "event",
      decisionType: "event_squad_generation",
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

describe("DefaultMatchboardPolicyAdapter", () => {
  it("returns results from default policy", async () => {
    const adapter = new DefaultMatchboardPolicyAdapter();
    const result = await adapter.evaluate(makeInput({
      players: [
        { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        { id: "p2", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
      ],
    }));
    expect(result.allowedPlayerIds).toContain("p1");
    expect(result.allowedPlayerIds).not.toContain("p2");
  });
});

describe("CompositePolicyAdapter", () => {
  it("merges results from default adapter with core invariant override", async () => {
    const defaultAdapter = new DefaultMatchboardPolicyAdapter();
    const composite = new CompositePolicyAdapter([defaultAdapter]);

    const result = await composite.evaluate(makeInput({
      players: [
        { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, recentMatchCount: 5, currentTeamIds: [] },
        { id: "p3", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
      ],
    }));

    expect(result.allowedPlayerIds).toContain("p1");
    expect(result.allowedPlayerIds).not.toContain("p3");
    expect(result.blocked["p3"]).toContain("removed_player_cannot_be_selected");
  });
});

describe("createPolicyPipeline", () => {
  it("returns default adapter when Rego is disabled", () => {
    const pipeline = createPolicyPipeline();
    expect(pipeline).toBeInstanceOf(DefaultMatchboardPolicyAdapter);
  });
});

describe("JSON DSL removal", () => {
  it("no JSON DSL adapter exists in the pipeline", () => {
    expect(createPolicyPipeline).toBeDefined();
    const pipeline = createPolicyPipeline();
    expect(pipeline.id).toBe("default-matchboard");
    expect(pipeline.name).toBe("Default Matchboard Policy");
  });

  it("core invariants still apply through composite pipeline", async () => {
    const defaultAdapter = new DefaultMatchboardPolicyAdapter();
    const composite = new CompositePolicyAdapter([defaultAdapter]);

    const result = await composite.evaluate(makeInput({
      players: [
        { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        { id: "p2", displayName: "Inactive", status: "INACTIVE", availableForContext: false, currentTeamIds: [] },
        { id: "p3", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
      ],
    }));

    expect(result.allowedPlayerIds).toContain("p1");
    expect(result.allowedPlayerIds).not.toContain("p2");
    expect(result.allowedPlayerIds).not.toContain("p3");
    expect(result.blocked["p2"]).toContain("inactive_player_cannot_be_selected");
    expect(result.blocked["p3"]).toContain("removed_player_cannot_be_selected");
  });
});