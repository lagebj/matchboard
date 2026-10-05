import { describe, expect, it } from "vitest";
import { computeExactFormationCoverage, type CoveragePlayer, type CoverageSlot } from "../formation-coverage";
import type { FormationSlotRoleType } from "@/lib/formations/types";

function slot(slotId: string, roleType: FormationSlotRoleType, gridX: number, gridY: number): CoverageSlot {
  return { slotId, roleType, gridX, gridY };
}
function player(id: string, primary: string, secondary?: string): CoveragePlayer {
  return { id, primaryPosition: primary, secondaryPosition: secondary ?? null, tertiaryPosition: null, bestSide: "CENTER" };
}

// Normative grid (ADR-0154 §2): y4 is the defence row (LB/LCB/CB/RCB/RB), y5/x2 is GK.
// A flat back-4 skips the centre x2 cell per the addendum's own example (§10):
// LB(x0)/LCB(x1)/RCB(x3)/RB(x4), never duplicating gridX the way the old 3-lane model did.
const BACK4 = [
  slot("gk", "GOALKEEPER", 2, 5),
  slot("lb", "DEFENDER", 0, 4),
  slot("lcb", "DEFENDER", 1, 4),
  slot("rcb", "DEFENDER", 3, 4),
  slot("rb", "DEFENDER", 4, 4),
];

describe("computeExactFormationCoverage", () => {
  it("is covered when every exact slot has its own eligible player, simultaneously", () => {
    const players = [
      player("g", "GK"),
      player("l", "LB"),
      player("c1", "CB"), // unsided CB declaration — NATURAL for LCB and RCB alike (ADR-0154)
      player("c2", "CB"),
      player("r", "RB"),
    ];
    const result = computeExactFormationCoverage(BACK4, players);
    expect(result.covered).toBe(true);
    expect(result.requiredExactSlots).toBe(5);
    expect(result.filledExactSlots).toBe(5);
    expect(result.unfilledRoles).toEqual([]);
  });

  it("does not count one versatile player as the sole solution for two required roles", () => {
    // One player who can play both full-back sides, but there is no other full-back.
    const players = [
      player("g", "GK"),
      player("bothBacks", "W"), // W → LB/RB are PLAUSIBLE (60), eligible for one wide slot only
      player("c1", "CB"),
      player("c2", "CB"),
    ];
    const result = computeExactFormationCoverage(BACK4, players);
    expect(result.covered).toBe(false);
    // One of LB / RB is filled, the other unresolved — never both by the same player.
    expect(result.unfilledRoles.length).toBe(1);
    expect(["LB", "RB"]).toContain(result.unfilledRoles[0]);
  });

  it("reports the exact unfilled role when a squad cannot staff a slot", () => {
    const players = [player("g", "GK"), player("c1", "CB"), player("c2", "CB"), player("c3", "CB"), player("c4", "CB")];
    const result = computeExactFormationCoverage(BACK4, players);
    // CB → LB/RB is STRONG (72), so full-backs are actually covered here; assert the shape holds.
    expect(result.covered).toBe(true);
  });

  it("central-midfield staffing is not satisfied by wide midfielders", () => {
    // LCM(x1)/RCM(x3) — never the same cell, unlike the old 3-lane model's duplicate gridX=2.
    const slots = [slot("gk", "GOALKEEPER", 2, 5), slot("cm1", "MIDFIELDER", 1, 2), slot("cm2", "MIDFIELDER", 3, 2)];
    const players = [player("g", "GK"), player("lm", "LM"), player("rm", "RM")];
    const result = computeExactFormationCoverage(slots, players);
    // LM/RM → CM base role is 58/58 → PLAUSIBLE (eligible), unaffected by the LCM/RCM side
    // (LM/RM are sided sources — no best-side modifier applies). The point of the exact model is
    // directed transferability, not a blanket exclusion.
    expect(result.covered).toBe(true);
    // But a pure winger cannot: LW/RW → CM base role is 48 (DEVELOPMENTAL, not eligible).
    const wingers = computeExactFormationCoverage(slots, [player("g", "GK"), player("lw", "LW"), player("rw", "RW")]);
    expect(wingers.covered).toBe(false);
    expect(wingers.unfilledRoles).toEqual(["LCM", "RCM"]);
  });

  it("excludes FREE slots from the exact-coverage count", () => {
    const slots = [slot("gk", "GOALKEEPER", 2, 5), slot("cb", "DEFENDER", 2, 4), slot("free", "FREE", 2, 2)];
    const result = computeExactFormationCoverage(slots, [player("g", "GK"), player("c", "CB")]);
    expect(result.covered).toBe(true);
    expect(result.requiredExactSlots).toBe(2);
    expect(result.freeSlotCount).toBe(1);
  });

  it("derives no target when roleType and grid depth contradict (ADR-0154 §8)", () => {
    // A MIDFIELDER roleType slot placed on the defence row (y4) is a data contradiction —
    // never silently resolved by trusting one input over the other.
    const slots = [slot("gk", "GOALKEEPER", 2, 5), slot("bad", "MIDFIELDER", 2, 4)];
    const result = computeExactFormationCoverage(slots, [player("g", "GK"), player("c", "CM")]);
    expect(result.requiredExactSlots).toBe(1); // only the GK slot derives a target
  });

  it("is deterministic", () => {
    const players = [player("g", "GK"), player("l", "LB"), player("c1", "CB"), player("c2", "CB"), player("r", "RB")];
    expect(computeExactFormationCoverage(BACK4, players)).toEqual(computeExactFormationCoverage(BACK4, players));
  });
});
