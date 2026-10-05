import { describe, expect, it } from "vitest";
import { computeCoPresencePairs } from "../co-presence";
import type { MatchSegment } from "@/lib/evidence/match-state-timeline";

/** Takes seconds (matching the source bundle's fixture text) and builds a MatchSegment in ms. */
function segment(startSeconds: number, endSeconds: number, playerIds: string[]): MatchSegment {
  const playersOnPitch = new Map(playerIds.map((id) => [id, { position: "CM", line: null, lane: null }]));
  return { startMs: startSeconds * 1000, endMs: endSeconds * 1000, playersOnPitch };
}

describe("computeCoPresencePairs (ADR-0155 §4)", () => {
  it("reproduces the mandatory fixture: A 0-600,900-1200 / B 300-1000 => 400s shared", () => {
    // Expressed as the maximal-constant-composition segments buildSegmentsFromIntervals would
    // itself produce: [0,300) A only, [300,600) A+B, [600,900) B only, [900,1000) A+B, [1000,1200) A only.
    const segments: MatchSegment[] = [
      segment(0, 300, ["A"]),
      segment(300, 600, ["A", "B"]),
      segment(600, 900, ["B"]),
      segment(900, 1000, ["A", "B"]),
      segment(1000, 1200, ["A"]),
    ];

    const pairs = computeCoPresencePairs(segments);

    expect(pairs).toEqual([{ playerAId: "A", playerBId: "B", sharedSeconds: 400 }]);
  });

  it("contributes nothing from a segment with fewer than two players", () => {
    expect(computeCoPresencePairs([segment(0, 600, ["A"])])).toEqual([]);
  });

  it("contributes nothing from a zero-duration segment", () => {
    expect(computeCoPresencePairs([segment(100, 100, ["A", "B"])])).toEqual([]);
  });

  it("aggregates every pair for a three-player segment", () => {
    const pairs = computeCoPresencePairs([segment(0, 100, ["A", "B", "C"])]);

    expect(pairs).toEqual([
      { playerAId: "A", playerBId: "B", sharedSeconds: 100 },
      { playerAId: "A", playerBId: "C", sharedSeconds: 100 },
      { playerAId: "B", playerBId: "C", sharedSeconds: 100 },
    ]);
  });

  it("is never presented as a chemistry/partnership score — output is exposure seconds only", () => {
    const pairs = computeCoPresencePairs([segment(0, 100, ["A", "B"])]);
    expect(Object.keys(pairs[0]!).sort()).toEqual(["playerAId", "playerBId", "sharedSeconds"]);
  });
});
