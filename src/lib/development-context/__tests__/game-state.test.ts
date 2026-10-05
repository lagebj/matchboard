import { describe, expect, it } from "vitest";
import { gameStateForInterval } from "../game-state";
import type { MatchStateInterval } from "@/lib/evidence/match-state-timeline";

type Fixture = Pick<MatchStateInterval, "scoreAtStart" | "timingQuality">;

describe("gameStateForInterval (ADR-0155 §4)", () => {
  it("reproduces the mandatory fixture sequence from scoreAtStart alone", () => {
    // 0-300 DRAWING, 300-700 LEADING, 700-1000 DRAWING, 1000-1200 TRAILING.
    const fixtures: Fixture[] = [
      { scoreAtStart: { for: 0, against: 0 }, timingQuality: "EXACT" }, // 0-300
      { scoreAtStart: { for: 1, against: 0 }, timingQuality: "EXACT" }, // 300-700 (goal at 300)
      { scoreAtStart: { for: 1, against: 1 }, timingQuality: "EXACT" }, // 700-1000 (equalizer at 700)
      { scoreAtStart: { for: 1, against: 2 }, timingQuality: "EXACT" }, // 1000-1200 (goal at 1000)
    ];

    expect(fixtures.map(gameStateForInterval)).toEqual(["DRAWING", "LEADING", "DRAWING", "TRAILING"]);
  });

  it("is UNKNOWN when the segment's own chronology is unavailable, regardless of score", () => {
    expect(
      gameStateForInterval({ scoreAtStart: { for: 3, against: 0 }, timingQuality: "UNAVAILABLE" }),
    ).toBe("UNKNOWN");
  });

  it.each(["EXACT", "INFERRED", "PARTIAL"] as const)(
    "still derives a state from scoreAtStart when timingQuality is %s",
    (timingQuality) => {
      expect(gameStateForInterval({ scoreAtStart: { for: 0, against: 0 }, timingQuality })).toBe("DRAWING");
    },
  );
});
