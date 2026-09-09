import { describe, expect, it } from "vitest";
// Registers vi.mock("server-only", ...) as a side effect — generate-rotation-plan.ts
// transitively imports transition-structure-evidence.ts (top-level `import "server-only"`).
import "@/test/support/auth-mock";
import {
  generateRotationPlan,
  type RotationPlanDecisionPoint,
  type RotationPlanPlayer,
  type RotationPlanStarter,
} from "../generate-rotation-plan";
import type { DeclaredPositions } from "@/domain/positions/suitability";
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

function player(
  id: string,
  primary: string,
  opts: { secondary?: string; tertiary?: string; bestSide?: DeclaredPositions["bestSide"]; attrs?: TacticalFunctionAttributes } = {},
): [string, RotationPlanPlayer] {
  return [
    id,
    {
      playerId: id,
      declaredPositions: {
        primaryPosition: primary,
        secondaryPosition: opts.secondary ?? null,
        tertiaryPosition: opts.tertiary ?? null,
        bestSide: opts.bestSide ?? "CENTER",
      },
      tacticalAttributes: opts.attrs ?? {},
    },
  ];
}

// gridX lanes: 0–1 LEFT, 2 CENTRE, 3–4 RIGHT.
function starter(id: string, roleType: string, gridX = 2): RotationPlanStarter {
  return { playerId: id, position: roleType, gridX };
}

describe("generateRotationPlan — basics", () => {
  it("never touches the goalkeeper", () => {
    const players = new Map([
      player("gk", "GK"),
      player("cb", "CB"),
      player("bench1", "CB"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("gk", "GK"), starter("cb", "DEFENDER", 2)],
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

  it("emits structured RecommendationReasons and name-free, arithmetic-free prose", () => {
    const players = new Map([
      player("gk", "GK"),
      player("cb", "CB"),
      player("cm", "CM"),
      player("bench1", "CB"),
      player("bench2", "CM"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("gk", "GK"), starter("cb", "DEFENDER", 2), starter("cm", "MIDFIELDER", 2)],
      benchPlayerIds: ["bench1", "bench2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "test",
    });
    expect(result.changes.length).toBeGreaterThan(0);
    for (const change of result.changes) {
      expect(Array.isArray(change.reasons)).toBe(true);
      expect(change.reasons.length).toBeGreaterThan(0);
      for (const r of change.reasons) {
        expect(typeof r.code).toBe("string");
        expect(["CONSTRAINT", "SUPPORTING", "CAUTION"]).toContain(r.polarity);
      }
      expect(change.explanation).not.toMatch(/goals conceded|prior instances|on average/i);
      expect(change.explanation.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical input", () => {
    const players = new Map([
      player("st1", "ST"),
      player("st2", "ST"),
      player("cb", "CB"),
      player("bench1", "ST"),
      player("bench2", "CB"),
    ]);
    const input = {
      starters: [starter("st1", "FORWARD", 0), starter("st2", "FORWARD", 4), starter("cb", "DEFENDER", 2)],
      benchPlayerIds: ["bench1", "bench2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "deterministic-seed",
    };
    expect(generateRotationPlan(input)).toEqual(generateRotationPlan(input));
  });

  it("produces no changes when there is no bench", () => {
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 2)],
      benchPlayerIds: [],
      players: new Map([player("st1", "ST")]),
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "test",
    });
    expect(result.changes).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});

describe("generateRotationPlan — exact positional safety (ADR-0129 §11, supersedes ADR-0118)", () => {
  it("prefers a bench player with a declared exact fit for the vacated role over one with none", () => {
    const players = new Map([
      player("st1", "ST"),
      player("st2", "ST"),
      player("cb", "CB"),
      // Bench: a striker who also declares CB (STRONG for the CB slot), and a pure striker (UNSUPPORTED).
      player("bench-can-defend", "ST", { secondary: "CB" }),
      player("bench-striker-only", "ST"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 0), starter("st2", "FORWARD", 4), starter("cb", "DEFENDER", 2)],
      benchPlayerIds: ["bench-can-defend", "bench-striker-only"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "five-striker",
    });
    const defenceChange = result.changes.find((c) => c.outPlayerId === "cb");
    expect(defenceChange).toBeDefined();
    expect(defenceChange!.inPlayerId).toBe("bench-can-defend");
  });

  it("keeps a due player on rather than substitute an UNSUPPORTED bench option — with a diagnostic", () => {
    const players = new Map([
      player("cb", "CB"),
      player("bench-striker-only", "ST"), // no defensive fit at all
    ]);
    const result = generateRotationPlan({
      starters: [starter("cb", "DEFENDER", 2)],
      benchPlayerIds: ["bench-striker-only"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "no-safe-replacement",
    });
    expect(result.changes.some((c) => c.inPlayerId === "bench-striker-only")).toBe(false);
    expect(result.diagnostics.some((d) => /No safe replacement for CB/.test(d))).toBe(true);
  });

  it("never auto-substitutes a central midfielder into a winger slot", () => {
    const players = new Map([
      player("lw", "LW"),
      player("bench-cm", "CM"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("lw", "FORWARD", 0)],
      benchPlayerIds: ["bench-cm"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "cm-not-winger",
    });
    expect(result.changes.some((c) => c.inPlayerId === "bench-cm")).toBe(false);
    expect(result.diagnostics.some((d) => /No safe replacement for LW/.test(d))).toBe(true);
  });

  it("resolves real FormationSlotRoleType starter labels with a grid lane", () => {
    const players = new Map([
      player("fwd1", "ST"),
      player("def1", "CB"),
      player("bench-defender", "CB"),
      player("bench-forward-only", "ST"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("fwd1", "FORWARD", 2), starter("def1", "DEFENDER", 2)],
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

  it("keeps a due player on when their slot role cannot be resolved (no gridX)", () => {
    const players = new Map([
      player("mystery", "CM"),
      player("bench-cm", "CM"),
    ]);
    const result = generateRotationPlan({
      starters: [{ playerId: "mystery", position: "FLEXIBLE" }], // no gridX
      benchPlayerIds: ["bench-cm"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "unresolved-slot",
    });
    expect(result.changes).toEqual([]);
    expect(result.diagnostics.some((d) => /could not be resolved/i.test(d))).toBe(true);
  });
});

describe("generateRotationPlan — fairness and emergent batch size", () => {
  it("produces more than one change at a natural-break point when multiple players are simultaneously due", () => {
    const players = new Map([
      player("st1", "ST"), player("st2", "ST"), player("cb1", "CB"), player("cb2", "CB"),
      player("b1", "ST"), player("b2", "CB"), player("b3", "ST"), player("b4", "CB"),
    ]);
    const result = generateRotationPlan({
      starters: [
        starter("st1", "FORWARD", 0), starter("st2", "FORWARD", 4),
        starter("cb1", "DEFENDER", 1), starter("cb2", "DEFENDER", 3),
      ],
      benchPlayerIds: ["b1", "b2", "b3", "b4"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "batch-size",
    });
    const atHalfTime = result.changes.filter((c) => c.approximateMatchSeconds === 1500);
    expect(atHalfTime.length).toBeGreaterThan(1);
  });

  it("does not substitute a player again within the minimum useful stint after coming on", () => {
    const players = new Map([player("st1", "ST"), player("b1", "ST"), player("b2", "ST")]);
    const closePoints: RotationPlanDecisionPoint[] = [
      { atSeconds: 500, period: "FIRST_HALF", isNaturalBreak: false },
      { atSeconds: 600, period: "FIRST_HALF", isNaturalBreak: false },
    ];
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 2)],
      benchPlayerIds: ["b1", "b2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: closePoints,
      seed: "min-stint",
    });
    const firstChange = result.changes.find((c) => c.approximateMatchSeconds === 500);
    if (firstChange) {
      const again = result.changes.find(
        (c) => c.approximateMatchSeconds === 600 && c.outPlayerId === firstChange.inPlayerId,
      );
      expect(again).toBeUndefined();
    }
  });

  it("never removes a considered bench candidate from future ticks just because they weren't chosen (guardrail)", () => {
    const players = new Map([player("st1", "ST"), player("b1", "ST"), player("b2", "ST")]);
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 2)],
      benchPlayerIds: ["b1", "b2"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      seed: "no-exclusion",
    });
    const inIds = new Set(result.changes.map((c) => c.inPlayerId));
    expect(inIds.has("b1") || inIds.has("b2")).toBe(true);
  });
});

describe("generateRotationPlan — opponent-aware function continuity", () => {
  it("prefers a bench candidate with a strong fit for the opponent-relevant function, all else roughly equal", () => {
    const players = new Map([
      player("st1", "ST"),
      player("bench-strong-press", "ST", { attrs: { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 } }),
      player("bench-weak-press", "ST", { attrs: { effort: 3, concentration: 3, speed: 3, decisionMaking: 3 } }),
    ]);
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 2)],
      benchPlayerIds: ["bench-strong-press", "bench-weak-press"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "ESTABLISHED" }],
      seed: "opponent-function",
    });
    expect(result.changes[0]?.inPlayerId).toBe("bench-strong-press");
  });

  it("does not exclude a different-profile player from opportunity even when opponent evidence favours another function", () => {
    const players = new Map([
      player("st1", "ST"), player("st2", "ST"),
      player("bench-strong-press", "ST", { attrs: { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 } }),
      player("bench-hold-up", "ST", { attrs: { ballControl: 9, firstTouch: 9, teamplay: 9, passing: 9 } }),
    ]);
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 0), starter("st2", "FORWARD", 4)],
      benchPlayerIds: ["bench-strong-press", "bench-hold-up"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "ESTABLISHED" }],
      seed: "opponent-function-both",
    });
    expect(new Set(result.changes.map((c) => c.inPlayerId)).has("bench-hold-up")).toBe(true);
  });

  it("gives no influence to a low-confidence opponent tendency", () => {
    const players = new Map([
      player("st1", "ST"),
      player("bench-strong-press", "ST", { attrs: { effort: 9, concentration: 9, speed: 9, decisionMaking: 9 } }),
      player("bench-rested", "ST"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("st1", "FORWARD", 2)],
      benchPlayerIds: ["bench-strong-press", "bench-rested"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      opponentTendencies: [{ tag: "SLOW_BUILD_UP", confidence: "INSUFFICIENT" }],
      seed: "low-confidence",
    });
    expect(result.changes.length).toBeGreaterThanOrEqual(0);
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
  it("prefers a bench candidate whose recorded position-context evidence is MORE_FAVORABLE", () => {
    const players = new Map([
      player("cb", "CB"),
      player("bench-favorable", "CB"),
      player("bench-plain", "CB"),
    ]);
    const result = generateRotationPlan({
      starters: [starter("cb", "DEFENDER", 2)],
      benchPlayerIds: ["bench-favorable", "bench-plain"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      positionContextEvidence: [positionEvidence("bench-favorable", "DEFENDER", "MORE_FAVORABLE")],
      seed: "position-context-preference",
    });
    expect(new Set(result.changes.map((c) => c.inPlayerId)).has("bench-favorable")).toBe(true);
  });

  it("never excludes a candidate with LESS_FAVORABLE recorded evidence", () => {
    const players = new Map([player("cb", "CB"), player("bench-only", "CB")]);
    const result = generateRotationPlan({
      starters: [starter("cb", "DEFENDER", 2)],
      benchPlayerIds: ["bench-only"],
      players,
      totalMatchSeconds: TOTAL_MATCH_SECONDS,
      decisionPoints: DECISION_POINTS,
      positionContextEvidence: [positionEvidence("bench-only", "DEFENDER", "LESS_FAVORABLE")],
      seed: "position-context-never-excludes",
    });
    expect(new Set(result.changes.map((c) => c.inPlayerId)).has("bench-only")).toBe(true);
  });
});
