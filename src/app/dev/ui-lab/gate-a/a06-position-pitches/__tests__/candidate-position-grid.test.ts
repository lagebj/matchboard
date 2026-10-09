import { describe, it, expect } from "vitest";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";
import { primaryDisplayCellFor, validFormationCellsFor } from "@/domain/positions/grid";
import { candidateDisplayCellFor } from "../candidate-position-grid";

/**
 * A06 candidate presentation-override invariants (owner visual feedback, 2026-10-09): LW/RW move
 * to the attacking-midfield (y1) line in THIS candidate only; every other position, and the real
 * production grid authority itself, is provably untouched.
 */
describe("A06 candidate position-grid override", () => {
  it("displays LW at the attacking-midfield line (x0, y1), matching the owner's table", () => {
    expect(candidateDisplayCellFor("LW")).toEqual({ gridX: 0, gridY: 1 });
  });

  it("displays RW at the attacking-midfield line (x4, y1), matching the owner's table", () => {
    expect(candidateDisplayCellFor("RW")).toEqual({ gridX: 4, gridY: 1 });
  });

  it("keeps GK central at (x2, y5) — unaffected, delegates straight to production", () => {
    expect(candidateDisplayCellFor("GK")).toEqual({ gridX: 2, gridY: 5 });
    expect(candidateDisplayCellFor("GK")).toEqual(primaryDisplayCellFor("GK"));
  });

  it("keeps CF central at (x2, y0), with LCF/RCF distinct beside it, all unaffected", () => {
    expect(candidateDisplayCellFor("CF")).toEqual({ gridX: 2, gridY: 0 });
    expect(candidateDisplayCellFor("LCF")).toEqual({ gridX: 1, gridY: 0 });
    expect(candidateDisplayCellFor("RCF")).toEqual({ gridX: 3, gridY: 0 });
  });

  it("changes nothing for any of the other 22 canonical positions — delegates straight to the real, untouched primaryDisplayCellFor", () => {
    const unaffected = CANONICAL_TACTICAL_POSITIONS.filter((p) => p !== "LW" && p !== "RW");
    expect(unaffected).toHaveLength(22);
    for (const position of unaffected) {
      expect(candidateDisplayCellFor(position)).toEqual(primaryDisplayCellFor(position));
    }
  });

  it("does not change the real production authority itself — primaryDisplayCellFor(LW/RW) is still the attack line (y0)", () => {
    expect(primaryDisplayCellFor("LW")).toEqual({ gridX: 0, gridY: 0 });
    expect(primaryDisplayCellFor("RW")).toEqual({ gridX: 4, gridY: 0 });
  });

  it("does not change formation-cell eligibility — LW/RW still validly occupy both y0 and y1", () => {
    expect(validFormationCellsFor("LW")).toEqual([
      { gridX: 0, gridY: 0 },
      { gridX: 0, gridY: 1 },
    ]);
    expect(validFormationCellsFor("RW")).toEqual([
      { gridX: 4, gridY: 0 },
      { gridX: 4, gridY: 1 },
    ]);
  });

  it("produces a unique screen cell for all 24 canonical positions — no coordinate collisions", () => {
    const cellKeys = CANONICAL_TACTICAL_POSITIONS.map((position) => {
      const { gridX, gridY } = candidateDisplayCellFor(position);
      return `${gridX}:${gridY}`;
    });
    expect(new Set(cellKeys).size).toBe(24);
  });

  it("leaves the attack line (y0) with x0/x4 empty now that LW/RW moved off it — only LCF/CF/RCF remain", () => {
    const y0Occupants = CANONICAL_TACTICAL_POSITIONS.filter((p) => candidateDisplayCellFor(p).gridY === 0);
    expect(y0Occupants.sort()).toEqual(["CF", "LCF", "RCF"].sort());
  });

  it("the attacking-midfield line (y1) now holds all five: LW, LAM, CAM, RAM, RW", () => {
    const y1Occupants = CANONICAL_TACTICAL_POSITIONS.filter((p) => candidateDisplayCellFor(p).gridY === 1);
    expect(y1Occupants.sort()).toEqual(["CAM", "LAM", "LW", "RAM", "RW"].sort());
  });
});
