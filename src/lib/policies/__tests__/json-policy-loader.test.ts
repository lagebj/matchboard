import { describe, it, expect } from "vitest";
import { parsePolicyPack, loadPolicyPackFromJson, PolicyLoadError } from "../json-policy-loader";

describe("parsePolicyPack", () => {
  it("parses a valid policy pack", () => {
    const pack = parsePolicyPack({
      id: "test-pack",
      name: "Test Pack",
      version: "1.0.0",
      rules: [
        {
          id: "deny-removed",
          effect: "deny",
          when: { all: [{ field: "player.status", op: "eq", value: "REMOVED" }] },
          reason: "Removed players cannot be selected.",
        },
      ],
    });
    expect(pack.id).toBe("test-pack");
    expect(pack.rules).toHaveLength(1);
  });

  it("rejects non-object input", () => {
    expect(() => parsePolicyPack(null)).toThrow(PolicyLoadError);
    expect(() => parsePolicyPack("string")).toThrow(PolicyLoadError);
  });

  it("rejects missing id", () => {
    expect(() => parsePolicyPack({ name: "X", version: "1", rules: [] })).toThrow(PolicyLoadError);
  });

  it("rejects missing rules array", () => {
    expect(() => parsePolicyPack({ id: "x", name: "X", version: "1" })).toThrow(PolicyLoadError);
  });

  it("rejects invalid effect", () => {
    expect(() => parsePolicyPack({
      id: "x", name: "X", version: "1",
      rules: [{ id: "r1", effect: "invalid", when: { all: [] } }],
    })).toThrow(PolicyLoadError);
  });

  it("rejects invalid operator", () => {
    expect(() => parsePolicyPack({
      id: "x", name: "X", version: "1",
      rules: [{ id: "r1", effect: "deny", when: { all: [{ field: "x", op: "regex", value: "y" }] } }],
    })).toThrow(PolicyLoadError);
  });

  it("rejects score_adjustment without numeric value", () => {
    expect(() => parsePolicyPack({
      id: "x", name: "X", version: "1",
      rules: [{ id: "r1", effect: "score_adjustment", when: { all: [] }, scoreAdjustment: "bad" }],
    })).toThrow(PolicyLoadError);
  });

  it("rejects warning without warning object", () => {
    expect(() => parsePolicyPack({
      id: "x", name: "X", version: "1",
      rules: [{ id: "r1", effect: "warning", when: { all: [] } }],
    })).toThrow(PolicyLoadError);
  });
});

describe("loadPolicyPackFromJson", () => {
  it("parses valid JSON", () => {
    const pack = loadPolicyPackFromJson(JSON.stringify({
      id: "test",
      name: "Test",
      version: "1.0.0",
      rules: [],
    }));
    expect(pack.id).toBe("test");
  });

  it("rejects invalid JSON", () => {
    expect(() => loadPolicyPackFromJson("{invalid")).toThrow(PolicyLoadError);
  });
});
