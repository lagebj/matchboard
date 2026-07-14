import { describe, it, expect } from "vitest";
import {
  DefaultMatchboardPolicyAdapter,
  JsonPolicyAdapter,
  CompositePolicyAdapter,
  createPolicyPipeline,
} from "../selection-policy-adapter";
import type { PolicyPack, SelectionPolicyInput } from "../types";

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

describe("JsonPolicyAdapter", () => {
  it("evaluates a custom policy pack", async () => {
    const pack: PolicyPack = {
      id: "custom-1",
      name: "Custom Policy",
      version: "1.0.0",
      rules: [
        {
          id: "deny-inactive",
          effect: "deny",
          when: { all: [{ field: "player.status", op: "eq", value: "INACTIVE" }] },
          reason: "Inactive players are blocked.",
        },
      ],
    };
    const adapter = new JsonPolicyAdapter(pack);
    const result = await adapter.evaluate(makeInput({
      players: [
        { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, currentTeamIds: [] },
        { id: "p2", displayName: "Inactive", status: "INACTIVE", availableForContext: false, currentTeamIds: [] },
      ],
    }));
    expect(result.blocked["p2"]).toContain("deny-inactive");
    expect(result.allowedPlayerIds).toContain("p1");
  });
});

describe("CompositePolicyAdapter", () => {
  it("merges results from multiple adapters with core invariant override", async () => {
    const defaultAdapter = new DefaultMatchboardPolicyAdapter();
    const customPack: PolicyPack = {
      id: "custom",
      name: "Custom",
      version: "1.0.0",
      rules: [
        {
          id: "deny-low-count",
          effect: "deny",
          when: { all: [{ field: "player.recentMatchCount", op: "eq", value: 0 }] },
          reason: "Player has no recent matches.",
        },
      ],
    };
    const jsonAdapter = new JsonPolicyAdapter(customPack);
    const composite = new CompositePolicyAdapter([defaultAdapter, jsonAdapter]);

    const result = await composite.evaluate(makeInput({
      players: [
        { id: "p1", displayName: "Active", status: "ACTIVE", availableForContext: true, recentMatchCount: 5, currentTeamIds: [] },
        { id: "p2", displayName: "NoRecent", status: "ACTIVE", availableForContext: true, recentMatchCount: 0, currentTeamIds: [] },
        { id: "p3", displayName: "Removed", status: "REMOVED", availableForContext: false, currentTeamIds: [] },
      ],
    }));

    expect(result.allowedPlayerIds).toContain("p1");
    expect(result.allowedPlayerIds).not.toContain("p2");
    expect(result.allowedPlayerIds).not.toContain("p3");
    expect(result.blocked["p2"]).toContain("deny-low-count");
    expect(result.blocked["p3"]).toContain("removed_player_cannot_be_selected");
  });
});

describe("createPolicyPipeline", () => {
  it("returns default adapter when no custom pack", () => {
    const pipeline = createPolicyPipeline(null);
    expect(pipeline).toBeInstanceOf(DefaultMatchboardPolicyAdapter);
  });

  it("returns composite adapter when custom pack provided", () => {
    const pack: PolicyPack = {
      id: "custom",
      name: "Custom",
      version: "1.0.0",
      rules: [],
    };
    const pipeline = createPolicyPipeline(pack);
    expect(pipeline).toBeInstanceOf(CompositePolicyAdapter);
  });
});
