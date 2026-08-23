import { describe, it, expect } from "vitest";
import { pairKey } from "./player-combinations-helpers";

describe("player-combinations-helpers", () => {
  it("produces the same key regardless of argument order", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });

  it("produces distinct keys for distinct pairs", () => {
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});
