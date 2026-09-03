import { describe, expect, it } from "vitest";
import {
  isEvidenceConfidentEnoughToInfluence,
  capEvidenceBonus,
  assertEvidenceDidNotExcludeCandidates,
} from "../evidence-guardrails";

describe("isEvidenceConfidentEnoughToInfluence", () => {
  it("is false for INSUFFICIENT confidence", () => {
    expect(isEvidenceConfidentEnoughToInfluence("INSUFFICIENT")).toBe(false);
  });

  it("is true for EMERGING and ESTABLISHED confidence", () => {
    expect(isEvidenceConfidentEnoughToInfluence("EMERGING")).toBe(true);
    expect(isEvidenceConfidentEnoughToInfluence("ESTABLISHED")).toBe(true);
  });
});

describe("capEvidenceBonus", () => {
  it("passes through a value below the cap unchanged", () => {
    expect(capEvidenceBonus(2, 4)).toBe(2);
  });

  it("caps a value above the cap", () => {
    expect(capEvidenceBonus(100, 4)).toBe(4);
  });

  it("clamps a negative raw bonus to 0 — unknown/negative evidence is never a penalty here", () => {
    expect(capEvidenceBonus(-5, 4)).toBe(0);
  });

  it("applies a multiplier after capping, not before", () => {
    // 10 capped to 4, then *1.5 = 6 — not 10*1.5=15 capped to 4.
    expect(capEvidenceBonus(10, 4, 1.5)).toBe(6);
  });

  it("a multiplier of 0 suppresses the bonus entirely", () => {
    expect(capEvidenceBonus(4, 4, 0)).toBe(0);
  });

  it("rounds the final result", () => {
    expect(capEvidenceBonus(3, 4, 1.5)).toBe(5); // 3 * 1.5 = 4.5 -> rounds to 5
  });
});

describe("assertEvidenceDidNotExcludeCandidates", () => {
  it("does not throw when every candidate present before is still present after", () => {
    expect(() =>
      assertEvidenceDidNotExcludeCandidates(["a", "b", "c"], ["c", "a", "b"], "test"),
    ).not.toThrow();
  });

  it("does not throw when evidence scoring only reorders candidates", () => {
    expect(() =>
      assertEvidenceDidNotExcludeCandidates(["a", "b", "c"], ["b", "c", "a"], "test"),
    ).not.toThrow();
  });

  it("throws when a candidate present before is missing after", () => {
    expect(() => assertEvidenceDidNotExcludeCandidates(["a", "b", "c"], ["a", "c"], "test")).toThrow(
      /Evidence guardrail violation in test/,
    );
  });

  it("throws naming the specific excluded candidate(s)", () => {
    expect(() => assertEvidenceDidNotExcludeCandidates(["a", "b", "c"], ["a"], "round-generation")).toThrow(
      /b, c/,
    );
  });

  it("does not throw for two empty lists", () => {
    expect(() => assertEvidenceDidNotExcludeCandidates([], [], "test")).not.toThrow();
  });
});
