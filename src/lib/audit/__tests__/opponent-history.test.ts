import { describe, it, expect } from "vitest";
import { computeMatchOutcome } from "@/lib/opponents/match-outcome";

/**
 * `getOpponentHistory()`'s own match-outcome branching was extracted to the pure
 * `computeMatchOutcome()` (ADR-0136 Phase 6, `src/lib/opponents/match-outcome.ts`) so it could be
 * reused by the Opponents list/detail pages without `getOpponentHistory()`'s own
 * `footballGroupId` scoping. This test now exercises the real extracted function directly instead
 * of re-deriving the same ternary inline — a more direct regression guard than before.
 */
describe("Opponent history result calculation (via computeMatchOutcome)", () => {
  it("correctly determines home win", () => {
    expect(computeMatchOutcome("HOME", 3, 1)).toBe("won");
  });

  it("correctly determines away win", () => {
    expect(computeMatchOutcome("AWAY", 1, 3)).toBe("won");
  });

  it("correctly determines home loss", () => {
    expect(computeMatchOutcome("HOME", 1, 3)).toBe("lost");
  });

  it("correctly determines draw", () => {
    expect(computeMatchOutcome("HOME", 2, 2)).toBe("drawn");
  });
});
