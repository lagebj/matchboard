import { describe, it, expect } from "vitest";
import {
  aggregatePositionContextEvidence,
  computePositionContextBonus,
  MAX_POSITION_CONTEXT_BONUS,
  type PlayerPositionContextEvidence,
} from "../position-context-evidence";
import type { ActualIntervalRow } from "../actual-timeline";
import type { GoalAttributionEvent } from "../combination-goal-attribution";

function interval(playerId: string, position: string, startedAtMs: number, endedAtMs: number): ActualIntervalRow {
  return { playerId, position, line: null, lane: null, startedAtMs, endedAtMs, source: "SUBSTITUTION" as ActualIntervalRow["source"], approximateTiming: false };
}

function goal(matchMs: number, team: "FOR" | "AGAINST"): GoalAttributionEvent {
  return { matchMs, team, scorerPlayerId: null, assistPlayerId: null, approximateTiming: false };
}

const FULL_MATCH_MS = 50 * 60 * 1000;

describe("aggregatePositionContextEvidence — pure aggregation", () => {
  it("splits exposure into the target player's own bucket and a baseline of every other player at the same position", () => {
    const samples = [
      {
        intervals: [interval("target", "CM", 0, FULL_MATCH_MS), interval("other1", "ST", 0, FULL_MATCH_MS)],
        goalEvents: [goal(5 * 60 * 1000, "FOR")],
      },
      {
        intervals: [interval("other2", "CM", 0, FULL_MATCH_MS), interval("target", "ST", 0, FULL_MATCH_MS)],
        goalEvents: [goal(10 * 60 * 1000, "AGAINST")],
      },
    ];

    const { player, baseline } = aggregatePositionContextEvidence(samples, "target", "CM", ["m1", "m2"]);

    expect(player!.matches).toBe(1);
    expect(player!.exposureMinutes).toBe(50);
    expect(player!.goalsFor).toBe(1);
    expect(baseline!.matches).toBe(1);
    expect(baseline!.exposureMinutes).toBe(50);
  });

  it("returns null buckets when there is no exposure at all for that position", () => {
    const samples = [{ intervals: [interval("someone", "ST", 0, FULL_MATCH_MS)], goalEvents: [] }];
    const { player, baseline } = aggregatePositionContextEvidence(samples, "target", "CM", ["m1"]);
    expect(player).toBeNull();
    expect(baseline).toBeNull();
  });

  it("only counts a goal that falls strictly within the interval's own time window", () => {
    const samples = [
      {
        intervals: [interval("target", "CM", 0, 20 * 60 * 1000)],
        goalEvents: [goal(25 * 60 * 1000, "FOR")], // outside the interval
      },
    ];
    const { player } = aggregatePositionContextEvidence(samples, "target", "CM", ["m1"]);
    expect(player!.goalsFor).toBe(0);
  });

  it("counts distinct matches, not distinct intervals — multiple intervals in one match count as one match", () => {
    const samples = [
      {
        intervals: [
          interval("target", "CM", 0, 10 * 60 * 1000),
          interval("target", "CM", 20 * 60 * 1000, 30 * 60 * 1000),
        ],
        goalEvents: [],
      },
    ];
    const { player } = aggregatePositionContextEvidence(samples, "target", "CM", ["m1"]);
    expect(player!.matches).toBe(1);
    expect(player!.exposureMinutes).toBe(20);
  });

  it("confidence rises from INSUFFICIENT to ESTABLISHED as matches accumulate (reuses the shared match-count confidence vocabulary)", () => {
    const fewSamples = Array.from({ length: 2 }, () => ({
      intervals: [interval("target", "CM", 0, FULL_MATCH_MS)],
      goalEvents: [] as GoalAttributionEvent[],
    }));
    const { player: fewPlayer } = aggregatePositionContextEvidence(fewSamples, "target", "CM", fewSamples.map((_, i) => `m${i}`));
    expect(fewPlayer!.confidence).toBe("INSUFFICIENT");

    const manySamples = Array.from({ length: 8 }, () => ({
      intervals: [interval("target", "CM", 0, FULL_MATCH_MS)],
      goalEvents: [] as GoalAttributionEvent[],
    }));
    const { player: manyPlayer } = aggregatePositionContextEvidence(manySamples, "target", "CM", manySamples.map((_, i) => `m${i}`));
    expect(manyPlayer!.confidence).toBe("ESTABLISHED");
  });
});

describe("computePositionContextBonus — automation integration guardrails", () => {
  const established: PlayerPositionContextEvidence["player"] = { matches: 8, exposureMinutes: 200, goalsFor: 5, goalsAgainst: 1, confidence: "ESTABLISHED" };
  const emerging: PlayerPositionContextEvidence["player"] = { matches: 4, exposureMinutes: 100, goalsFor: 3, goalsAgainst: 1, confidence: "EMERGING" };
  const insufficient: PlayerPositionContextEvidence["player"] = { matches: 1, exposureMinutes: 20, goalsFor: 1, goalsAgainst: 0, confidence: "INSUFFICIENT" };

  function evidence(overrides: Partial<PlayerPositionContextEvidence>): PlayerPositionContextEvidence {
    return {
      playerId: "p1",
      position: "CM",
      player: established,
      baseline: established,
      outcomeDifference: "MORE_FAVORABLE",
      structuralNote: null,
      explanation: "",
      ...overrides,
    };
  }

  it("gives a positive, capped bonus for ESTABLISHED MORE_FAVORABLE evidence", () => {
    const bonus = computePositionContextBonus(evidence({ player: established, outcomeDifference: "MORE_FAVORABLE" }));
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(MAX_POSITION_CONTEXT_BONUS);
  });

  it("gives a smaller bonus for EMERGING than ESTABLISHED confidence", () => {
    const emergingBonus = computePositionContextBonus(evidence({ player: emerging, outcomeDifference: "MORE_FAVORABLE" }));
    const establishedBonus = computePositionContextBonus(evidence({ player: established, outcomeDifference: "MORE_FAVORABLE" }));
    expect(emergingBonus).toBeGreaterThan(0);
    expect(emergingBonus).toBeLessThan(establishedBonus);
  });

  it("gives zero bonus — never a penalty — for LESS_FAVORABLE evidence", () => {
    expect(computePositionContextBonus(evidence({ outcomeDifference: "LESS_FAVORABLE" }))).toBe(0);
  });

  it("gives zero bonus for SIMILAR evidence", () => {
    expect(computePositionContextBonus(evidence({ outcomeDifference: "SIMILAR" }))).toBe(0);
  });

  it("gives zero bonus for INSUFFICIENT-confidence evidence, even if outcomeDifference somehow claims MORE_FAVORABLE", () => {
    expect(computePositionContextBonus(evidence({ player: insufficient, outcomeDifference: "MORE_FAVORABLE" }))).toBe(0);
  });

  it("gives zero bonus when no evidence was found at all (unknown stays neutral)", () => {
    expect(computePositionContextBonus(undefined)).toBe(0);
  });

  it("never returns a negative value", () => {
    for (const outcome of ["MORE_FAVORABLE", "SIMILAR", "LESS_FAVORABLE", null] as const) {
      expect(computePositionContextBonus(evidence({ outcomeDifference: outcome }))).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Position-context evidence language — neutral terminology (AGENTS.md rule)", () => {
  const DISALLOWED = [/\bbad\b/i, /\bnegative\b/i, /\bweak\b/i, /\bpoor\b/i, /\bharmful\b/i, /\bproblematic\b/i, /\bunderperform/i, /\brisky\b/i];

  it("no exported outcome-difference value or phrase uses judgemental language", () => {
    const values: Array<PlayerPositionContextEvidence["outcomeDifference"]> = ["MORE_FAVORABLE", "SIMILAR", "LESS_FAVORABLE", null];
    for (const value of values) {
      if (value === null) continue;
      for (const pattern of DISALLOWED) {
        expect(pattern.test(value)).toBe(false);
      }
    }
  });
});
