import { describe, expect, it } from "vitest";
import { canonicalJsonStringify, computeInputRevision } from "../version";

describe("computeInputRevision (ADR-0155 §6)", () => {
  it("is stable across object-key insertion order", () => {
    const a = computeInputRevision({ matchId: "m1", metricVersion: 1, playerId: "p1" });
    const b = computeInputRevision({ playerId: "p1", matchId: "m1", metricVersion: 1 });

    expect(a).toBe(b);
  });

  it("is stable across source-query ordering of a primitive id array", () => {
    const a = computeInputRevision({ intervalIds: ["c", "a", "b"] });
    const b = computeInputRevision({ intervalIds: ["b", "c", "a"] });

    expect(a).toBe(b);
  });

  it("changes when a value changes", () => {
    const a = computeInputRevision({ intervalIds: ["a", "b"], metricVersion: 1 });
    const b = computeInputRevision({ intervalIds: ["a", "b"], metricVersion: 2 });

    expect(a).not.toBe(b);
  });

  it("changes when a coordinate/interval input is added", () => {
    const a = computeInputRevision({ intervalIds: ["a", "b"] });
    const b = computeInputRevision({ intervalIds: ["a", "b", "c"] });

    expect(a).not.toBe(b);
  });

  it("is unaffected by computedAt, because callers never include it", () => {
    const sharedInputs = { intervalIds: ["a", "b"], metricVersion: 1 };

    const first = computeInputRevision(sharedInputs);
    const second = computeInputRevision(sharedInputs);

    expect(first).toBe(second);
  });

  it("documents why computedAt must be excluded: including it would change the hash every time", () => {
    const withComputedAtOne = computeInputRevision({ intervalIds: ["a"], computedAt: "2026-01-01T00:00:00.000Z" });
    const withComputedAtTwo = computeInputRevision({ intervalIds: ["a"], computedAt: "2026-01-02T00:00:00.000Z" });

    expect(withComputedAtOne).not.toBe(withComputedAtTwo);
  });

  it("preserves the order of arrays of objects (not generically sortable)", () => {
    const ordered = canonicalJsonStringify({ dimensions: [{ zoneId: "D1_L1" }, { zoneId: "D2_L2" }] });
    const reordered = canonicalJsonStringify({ dimensions: [{ zoneId: "D2_L2" }, { zoneId: "D1_L1" }] });

    expect(ordered).not.toBe(reordered);
  });
});
