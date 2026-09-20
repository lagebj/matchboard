import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeSourceFingerprint, stableSerialize } from "@/lib/ai/fingerprints";

describe("ai/fingerprints: stableSerialize", () => {
  it("produces the same output regardless of key insertion order", () => {
    const a = stableSerialize({ b: 1, a: 2, c: 3 });
    const b = stableSerialize({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("sorts keys at every nesting level, not just the top", () => {
    const a = stableSerialize({ outer: { z: 1, y: 2 } });
    const b = stableSerialize({ outer: { y: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it("preserves array element order — it is not the caller's job to be re-sorted here", () => {
    const serialized = stableSerialize({ items: [3, 1, 2] });
    expect(serialized).toBe('{"items":[3,1,2]}');
  });

  it("handles null, booleans, numbers, and nested arrays of objects", () => {
    const serialized = stableSerialize({ n: null, flag: true, count: 0, rows: [{ b: 2, a: 1 }] });
    expect(serialized).toBe('{"count":0,"flag":true,"n":null,"rows":[{"a":1,"b":2}]}');
  });
});

describe("ai/fingerprints: computeSourceFingerprint", () => {
  it("is deterministic for the same normalized context", () => {
    const context = { capability: "post_match_review", players: [{ ref: "P01", minutes: 60 }] };
    expect(computeSourceFingerprint(context)).toBe(computeSourceFingerprint(context));
  });

  it("is insensitive to object key order, since it goes through stableSerialize", () => {
    const a = computeSourceFingerprint({ b: 1, a: 2 });
    const b = computeSourceFingerprint({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("changes when any field value changes", () => {
    const a = computeSourceFingerprint({ minutes: 60 });
    const b = computeSourceFingerprint({ minutes: 61 });
    expect(a).not.toBe(b);
  });

  it("changes when array order changes (arrays are meaningful, unlike object keys)", () => {
    const a = computeSourceFingerprint({ refs: ["P01", "P02"] });
    const b = computeSourceFingerprint({ refs: ["P02", "P01"] });
    expect(a).not.toBe(b);
  });

  it("returns a 64-character lowercase hex string (SHA-256)", () => {
    const fingerprint = computeSourceFingerprint({ x: 1 });
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
