import { describe, expect, it } from "vitest";
import { matchSlotsToCandidates, type SafeMatchCandidate, type SafeMatchSlot } from "../matching";

function slot(slotId: string, targetRole: SafeMatchSlot["targetRole"]): SafeMatchSlot {
  return { slotId, targetRole };
}
function cand(id: string, primary: string, secondary?: string, tertiary?: string): SafeMatchCandidate {
  return { candidateId: id, declaredPositions: { primaryPosition: primary, secondaryPosition: secondary ?? null, tertiaryPosition: tertiary ?? null, bestSide: "CENTER" } };
}
const SEED = { seed: "match-test" };

describe("matchSlotsToCandidates — eligibility gate", () => {
  it("leaves a required slot unresolved when no automatically eligible candidate exists", () => {
    const result = matchSlotsToCandidates([slot("lw", "LW")], [cand("cm", "CM")], SEED);
    expect(result.assignments).toEqual([]);
    expect(result.unfilledSlots).toEqual([{ slotId: "lw", role: "LW" }]);
    expect(result.benchedCandidateIds).toEqual(["cm"]);
  });

  it("never fills a slot from a DEVELOPMENTAL or UNSUPPORTED candidate to satisfy a count", () => {
    const result = matchSlotsToCandidates(
      [slot("lw", "LW"), slot("rw", "RW")],
      [cand("winger", "LW"), cand("cm", "CM"), cand("cb", "CB")],
      SEED,
    );
    const filled = result.assignments.map((a) => a.candidateId);
    expect(filled).toEqual(["winger"]);
    expect(result.unfilledSlots.map((s) => s.role).sort()).toEqual(["RW"]);
    expect(new Set(result.benchedCandidateIds)).toEqual(new Set(["cm", "cb"]));
  });

  it("fills with PLAUSIBLE when that is the best available (still eligible)", () => {
    const result = matchSlotsToCandidates([slot("lw", "LW")], [cand("rb", "RB")], SEED);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].tier).toBe("PLAUSIBLE");
  });
});

describe("matchSlotsToCandidates — tier precedes fairness and evidence (§9)", () => {
  it("a STRONG candidate with no fairness need beats a PLAUSIBLE candidate with maximum fairness need", () => {
    const result = matchSlotsToCandidates(
      [slot("lw", "LW")],
      [cand("strong", "ST"), cand("plausible", "RB")],
      { seed: "s", fairness: (id) => (id === "plausible" ? 999_999 : 0) },
    );
    expect(result.assignments[0].candidateId).toBe("strong");
    expect(result.assignments[0].tier).toBe("STRONG");
  });

  it("fairness decides only within a tier", () => {
    const result = matchSlotsToCandidates(
      [slot("lw", "LW")],
      [cand("a", "ST"), cand("b", "ST")],
      { seed: "s", fairness: (id) => (id === "b" ? 500 : 0) },
    );
    expect(result.assignments[0].candidateId).toBe("b");
  });

  it("exact suitability decides when tier and fairness tie", () => {
    // LB→LW 76 (STRONG) vs ST→LW 80 (STRONG): same tier, ST higher suitability.
    const result = matchSlotsToCandidates(
      [slot("lw", "LW")],
      [cand("lb", "LB"), cand("st", "ST")],
      { seed: "s" },
    );
    expect(result.assignments[0].candidateId).toBe("st");
  });

  it("preference decides only when tier, fairness and suitability all tie", () => {
    const result = matchSlotsToCandidates(
      [slot("lw", "LW")],
      [cand("a", "ST"), cand("b", "ST")],
      { seed: "s", preference: (id) => (id === "a" ? 999 : 0) },
    );
    expect(result.assignments[0].candidateId).toBe("a");
  });
});

describe("matchSlotsToCandidates — scarce-role / simultaneous coverage (§10/§12)", () => {
  it("does not consume one versatile player for two slots — each slot gets its own player", () => {
    const result = matchSlotsToCandidates(
      [slot("lw", "LW"), slot("rw", "RW")],
      [cand("versatile", "W"), cand("pureLeft", "LW")],
      SEED,
    );
    expect(result.assignments).toHaveLength(2);
    const byId = new Set(result.assignments.map((a) => a.candidateId));
    expect(byId).toEqual(new Set(["versatile", "pureLeft"]));
    expect(result.unfilledSlots).toEqual([]);
  });

  it("maximizes the number of eligible-filled slots rather than greedily taking the best per slot", () => {
    // Greedy on `lw` first would take `lmPlayer` (LM→LW 92 NATURAL) and strand `lw`-only
    // coverage... optimal keeps both NATURAL: wingerPlayer→lw, lmPlayer→lm.
    const result = matchSlotsToCandidates(
      [slot("lw", "LW"), slot("lm", "LM")],
      [cand("wingerPlayer", "LW"), cand("lmPlayer", "LM")],
      SEED,
    );
    expect(result.unfilledSlots).toEqual([]);
    const map = new Map(result.assignments.map((a) => [a.slotId, a.candidateId]));
    expect(map.get("lw")).toBe("wingerPlayer");
    expect(map.get("lm")).toBe("lmPlayer");
    expect(result.assignments.every((a) => a.tier === "NATURAL")).toBe(true);
  });

  it("maximizes NATURAL count when total filled count is equal", () => {
    // Two ways to fill both slots; the matcher must pick the one with more NATURAL fits.
    const result = matchSlotsToCandidates(
      [slot("lw", "LW"), slot("st", "ST")],
      [cand("trueWinger", "LW"), cand("trueStriker", "ST")],
      SEED,
    );
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.every((a) => a.tier === "NATURAL")).toBe(true);
    const map = new Map(result.assignments.map((a) => [a.slotId, a.candidateId]));
    expect(map.get("lw")).toBe("trueWinger");
    expect(map.get("st")).toBe("trueStriker");
  });

  it("rotation shape: four due, three safe replacements → three matched, one slot unresolved", () => {
    const result = matchSlotsToCandidates(
      [slot("s1", "CB"), slot("s2", "CB"), slot("s3", "CB"), slot("s4", "CB")],
      [cand("d1", "CB"), cand("d2", "CB"), cand("d3", "CB"), cand("striker", "ST")],
      SEED,
    );
    expect(result.assignments).toHaveLength(3);
    expect(result.unfilledSlots).toHaveLength(1);
    expect(result.benchedCandidateIds).toEqual(["striker"]);
  });
});

describe("matchSlotsToCandidates — determinism", () => {
  const slots = [slot("lw", "LW"), slot("rw", "RW"), slot("st", "ST")];
  const candidates = [cand("a", "LW"), cand("b", "RW"), cand("c", "ST"), cand("d", "W")];

  it("identical input yields identical output", () => {
    const r1 = matchSlotsToCandidates(slots, candidates, { seed: "x" });
    const r2 = matchSlotsToCandidates(slots, candidates, { seed: "x" });
    expect(r1).toEqual(r2);
  });

  it("resolves a genuine tie deterministically, and seed can change which tied candidate wins", () => {
    const tie = [cand("p1", "ST"), cand("p2", "ST")];
    const a = matchSlotsToCandidates([slot("lw", "LW")], tie, { seed: "seed-A" });
    const b = matchSlotsToCandidates([slot("lw", "LW")], tie, { seed: "seed-A" });
    expect(a.assignments[0].candidateId).toBe(b.assignments[0].candidateId);
    // Not asserting a specific winner, only that the choice is stable per seed.
  });
});

describe("matchSlotsToCandidates — edge cases", () => {
  it("no slots → everyone benched", () => {
    const result = matchSlotsToCandidates([], [cand("a", "ST")], SEED);
    expect(result).toEqual({ assignments: [], unfilledSlots: [], benchedCandidateIds: ["a"] });
  });

  it("no candidates → every slot unresolved", () => {
    const result = matchSlotsToCandidates([slot("gk", "GK"), slot("lw", "LW")], [], SEED);
    expect(result.assignments).toEqual([]);
    expect(result.unfilledSlots).toHaveLength(2);
  });

  it("goalkeeper role matches a declared goalkeeper", () => {
    const result = matchSlotsToCandidates([slot("gk", "GK")], [cand("keeper", "GK"), cand("cb", "CB")], SEED);
    expect(result.assignments).toEqual([
      { slotId: "gk", candidateId: "keeper", role: "GK", tier: "NATURAL", suitabilityScore: 100 },
    ]);
  });
});
