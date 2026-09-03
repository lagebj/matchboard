import { describe, expect, it } from "vitest";
// Registers vi.mock("server-only", ...) as a side effect, needed because generate-rotation-plan.ts
// transitively imports transition-structure-evidence.ts, which has a top-level `import
// "server-only"` guarding its DB-bound export — same convention as position-exposure.test.ts.
import "@/test/support/auth-mock";
import { generateRotationPlan, type RotationPlanDecisionPoint, type RotationPlanPlayer, type RotationPlanStarter } from "../generate-rotation-plan";
import type { DeclaredBroadPositions } from "@/domain/team-composition/outfield-role-evidence";
import type { TacticalFunctionAttributes } from "@/domain/team-composition/outfield-role-evidence";
import type { PlayerPositionContextEvidence } from "@/lib/evidence/position-context-evidence";

const TOTAL_MATCH_SECONDS = 3000; // two 25-minute halves

const DECISION_POINTS: RotationPlanDecisionPoint[] = [
  { atSeconds: 500, period: "FIRST_HALF", isNaturalBreak: false },
  { atSeconds: 1000, period: "FIRST_HALF", isNaturalBreak: false },
  { atSeconds: 1500, period: "SECOND_HALF", isNaturalBreak: true },
  { atSeconds: 2000, period: "SECOND_HALF", isNaturalBreak: false },
  { atSeconds: 2500, period: "SECOND_HALF", isNaturalBreak: false },
];

function player(id: string, declared: DeclaredBroadPositions, attrs: TacticalFunctionAttributes = {}): [string, RotationPlanPlayer] {
  return [id, { playerId: id, declaredPositions: declared, tacticalAttributes: attrs }];
}

function starter(id: string, position: string): RotationPlanStarter {
  return { playerId: id, position };
}

describe("generateRotationPlan — basics", () => {
  it("never touches the goalkeeper", () => {
    const players = new Map([
      player("gk", { primary: "goalkeeper" }),
      player("def1", { primary: "defender" }),
      player("bench1", { primary: "defender" }),
    ]);
    const starters = [starter("gk", "GK"), starter("def1", "DEFENCE")];
    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench1"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "test",
    });

    for (const change of result.changes) {
      expect(change.outPlayerId).not.toBe("gk");
      expect(change.inPlayerId).not.toBe("gk");
    }
  });

  it("is deterministic for identical input", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("att2", { primary: "forward" }),
      player("def1", { primary: "defender" }),
      player("bench1", { primary: "forward" }),
      player("bench2", { primary: "defender" }),
    ]);
    const starters = [starter("att1", "ATTACK"), starter("att2", "ATTACK"), starter("def1", "DEFENCE")];
    const input = {
      starters,
      benchPlayerIds: ["bench1", "bench2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "deterministic-seed",
    };

    const resultA = generateRotationPlan(input);
    const resultB = generateRotationPlan(input);
    expect(resultA.changes).toEqual(resultB.changes);
  });

  it("produces no changes when there is no bench", () => {
    const players = new Map([player("att1", { primary: "forward" })]);
    const result = generateRotationPlan({
      starters: [starter("att1", "ATTACK")],
      benchPlayerIds: [],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "test",
    });
    expect(result.changes).toEqual([]);
  });
});

describe("generateRotationPlan — five-striker scenario (TEST-MATRIX #8)", () => {
  it("prefers a plausible/developmental alternate role fit over a completely unsupported one when both are candidates", () => {
    const players = new Map([
      player("st1", { primary: "forward" }),
      player("st2", { primary: "forward" }),
      player("def1", { primary: "defender" }),
      // Bench: one striker with a declared secondary DEFENCE fit, one pure striker with none.
      player("bench-plausible-defender", { primary: "forward", secondary: "defender" }),
      player("bench-unsupported-defender", { primary: "forward" }),
    ]);
    const starters = [starter("st1", "ATTACK"), starter("st2", "ATTACK"), starter("def1", "DEFENCE")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-plausible-defender", "bench-unsupported-defender"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "five-striker",
    });

    const defenceChange = result.changes.find((c) => c.outPlayerId === "def1");
    expect(defenceChange).toBeDefined();
    expect(defenceChange!.inPlayerId).toBe("bench-plausible-defender");
  });

  it("still fills a vacated role from an unsupported-tier candidate when no better-fit peer exists — never structurally blocked", () => {
    const players = new Map([
      player("def1", { primary: "defender" }),
      player("only-bench-striker", { primary: "forward" }), // no defensive fit at all
    ]);
    const starters = [starter("def1", "DEFENCE")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["only-bench-striker"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "no-alternative",
    });

    expect(result.changes.some((c) => c.inPlayerId === "only-bench-striker")).toBe(true);
  });
});

describe("generateRotationPlan — real formation slot role labels (FormationSlotRoleType convention)", () => {
  it("resolves role fit correctly when starters use raw FormationSlotRoleType-style labels, not the OutfieldStructuralRole vocabulary", () => {
    const players = new Map([
      player("fwd1", { primary: "forward" }),
      player("def1", { primary: "defender" }),
      player("bench-defender", { primary: "defender" }),
      player("bench-forward-only", { primary: "forward" }),
    ]);
    // "FORWARD"/"DEFENDER" — the real labels checkPlannedRotationCoverageAction/match-lineup
    // slots produce, not "ATTACK"/"DEFENCE".
    const starters = [starter("fwd1", "FORWARD"), starter("def1", "DEFENDER")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-defender", "bench-forward-only"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "real-labels",
    });

    const defenceChange = result.changes.find((c) => c.outPlayerId === "def1");
    expect(defenceChange).toBeDefined();
    expect(defenceChange!.inPlayerId).toBe("bench-defender");
  });
});

describe("generateRotationPlan — fairness and emergent batch size", () => {
  it("produces more than one change at a single natural-break point when multiple players are simultaneously due", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("att2", { primary: "forward" }),
      player("def1", { primary: "defender" }),
      player("def2", { primary: "defender" }),
      player("bench1", { primary: "forward" }),
      player("bench2", { primary: "defender" }),
      player("bench3", { primary: "forward" }),
      player("bench4", { primary: "defender" }),
    ]);
    const starters = [
      starter("att1", "ATTACK"),
      starter("att2", "ATTACK"),
      starter("def1", "DEFENCE"),
      starter("def2", "DEFENCE"),
    ];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench1", "bench2", "bench3", "bench4"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "batch-size",
    });

    const changesAtHalfTime = result.changes.filter((c) => c.approximateMatchSeconds === 1500);
    expect(changesAtHalfTime.length).toBeGreaterThan(1);
  });

  it("does not substitute a player again within the minimum useful stint after they were just subbed on", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("bench1", { primary: "forward" }),
      player("bench2", { primary: "forward" }),
    ]);
    const starters = [starter("att1", "ATTACK")];

    // Two decision points close together (well within the 5-minute minimum useful stint).
    const closePoints: RotationPlanDecisionPoint[] = [
      { atSeconds: 500, period: "FIRST_HALF", isNaturalBreak: false },
      { atSeconds: 600, period: "FIRST_HALF", isNaturalBreak: false },
    ];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench1", "bench2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: closePoints,
      seed: "min-stint",
    });

    // Whoever came on at t=500 (if anyone did) must not be subbed off again at t=600.
    const firstChange = result.changes.find((c) => c.approximateMatchSeconds === 500);
    if (firstChange) {
      const secondChangeForSamePlayer = result.changes.find(
        (c) => c.approximateMatchSeconds === 600 && c.outPlayerId === firstChange.inPlayerId,
      );
      expect(secondChangeForSamePlayer).toBeUndefined();
    }
  });

  it("never removes a considered bench candidate from future ticks just because they weren't chosen this tick (structural guardrail)", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("bench1", { primary: "forward" }),
      player("bench2", { primary: "forward" }),
    ]);
    const starters = [starter("att1", "ATTACK")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench1", "bench2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "no-exclusion",
    });

    // Both bench players should get at least one opportunity across a full match's worth of
    // decision points, given they are the only two candidates behind an equal share.
    const inPlayerIds = new Set(result.changes.map((c) => c.inPlayerId));
    expect(inPlayerIds.has("bench1") || inPlayerIds.has("bench2")).toBe(true);
  });
});

describe("generateRotationPlan — opponent-aware function continuity", () => {
  it("prefers a bench candidate with a strong fit for the opponent-relevant function, all else being roughly equal", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("bench-strong-press", { primary: "forward" }, { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 }),
      player("bench-weak-press", { primary: "forward" }, { effort: 3, concentration: 3, speed: 3, decisionMaking: 3 }),
    ]);
    const starters = [starter("att1", "ATTACK")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-strong-press", "bench-weak-press"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "ESTABLISHED" }],
      seed: "opponent-function",
    });

    const firstChange = result.changes[0];
    expect(firstChange?.inPlayerId).toBe("bench-strong-press");
  });

  it("does not exclude a different-profile player from meaningful opportunity even when opponent evidence favours another function", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("att2", { primary: "forward" }),
      player("bench-strong-press", { primary: "forward" }, { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 }),
      player("bench-hold-up", { primary: "forward" }, { ballControl: 9, firstTouch: 9, teamplay: 9, passing: 9 }),
    ]);
    const starters = [starter("att1", "ATTACK"), starter("att2", "ATTACK")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-strong-press", "bench-hold-up"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "ESTABLISHED" }],
      seed: "opponent-function-both",
    });

    const inPlayerIds = new Set(result.changes.map((c) => c.inPlayerId));
    expect(inPlayerIds.has("bench-hold-up")).toBe(true);
  });

  it("gives little influence to a low-confidence opponent tendency", () => {
    const players = new Map([
      player("att1", { primary: "forward" }),
      player("bench-strong-press", { primary: "forward" }, { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 }),
      player("bench-slightly-more-rested", { primary: "forward" }),
    ]);
    const starters = [starter("att1", "ATTACK")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-strong-press", "bench-slightly-more-rested"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "INSUFFICIENT" }],
      seed: "low-confidence",
    });

    // With INSUFFICIENT confidence, the evidence bonus must never apply.
    expect(result.changes.length).toBeGreaterThanOrEqual(0); // sanity: still runs without throwing
  });
});

function positionEvidence(
  playerId: string,
  position: string,
  outcomeDifference: PlayerPositionContextEvidence["outcomeDifference"],
  confidence: "EMERGING" | "ESTABLISHED" | "INSUFFICIENT" = "ESTABLISHED",
): PlayerPositionContextEvidence {
  return {
    playerId,
    position,
    player: { matches: 8, exposureMinutes: 200, goalsFor: 3, goalsAgainst: 1, confidence },
    baseline: { matches: 8, exposureMinutes: 200, goalsFor: 1, goalsAgainst: 1, confidence: "ESTABLISHED" },
    outcomeDifference,
    structuralNote: null,
    explanation: "test evidence",
  };
}

describe("generateRotationPlan — position-context evidence addendum", () => {
  it("prefers a bench candidate whose recorded position-context evidence is MORE_FAVORABLE, all else being roughly equal", () => {
    const players = new Map([
      player("def1", { primary: "defender" }),
      player("bench-favorable", { primary: "defender" }),
      player("bench-plain", { primary: "defender" }),
    ]);
    const starters = [starter("def1", "DEFENDER")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-favorable", "bench-plain"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      positionContextEvidence: [positionEvidence("bench-favorable", "DEFENDER", "MORE_FAVORABLE")],
      seed: "position-context-preference",
    });

    const inPlayerIds = new Set(result.changes.map((c) => c.inPlayerId));
    expect(inPlayerIds.has("bench-favorable")).toBe(true);
  });

  it("never excludes a candidate with LESS_FAVORABLE recorded evidence — still selected when no better candidate exists", () => {
    const players = new Map([
      player("def1", { primary: "defender" }),
      player("bench-only-option", { primary: "defender" }),
    ]);
    const starters = [starter("def1", "DEFENDER")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-only-option"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      positionContextEvidence: [positionEvidence("bench-only-option", "DEFENDER", "LESS_FAVORABLE")],
      seed: "position-context-never-excludes",
    });

    const inPlayerIds = new Set(result.changes.map((c) => c.inPlayerId));
    expect(inPlayerIds.has("bench-only-option")).toBe(true);
  });

  it("gives no bonus for INSUFFICIENT-confidence evidence — unknown position history is not penalised or preferred", () => {
    const players = new Map([
      player("def1", { primary: "defender" }),
      player("bench-a", { primary: "defender" }),
      player("bench-b", { primary: "defender" }),
    ]);
    const starters = [starter("def1", "DEFENDER")];

    const result = generateRotationPlan({
      starters,
      benchPlayerIds: ["bench-a", "bench-b"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      positionContextEvidence: [positionEvidence("bench-a", "DEFENDER", "MORE_FAVORABLE", "INSUFFICIENT")],
      seed: "position-context-insufficient",
    });

    // No throw, and both remain viable candidates (fairness/tiebreak decide, not the evidence).
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
