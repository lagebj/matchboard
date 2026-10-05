import { describe, expect, it } from "vitest";
import { canonicalPositionForCell, primaryDisplayCellFor, validFormationCellsFor } from "../grid";
import { CANONICAL_TACTICAL_POSITIONS, type CanonicalTacticalPosition } from "../roles";

describe("canonicalPositionForCell — normative 5x6 grid (ADR-0154 §2)", () => {
  const cases: Array<[number, number, CanonicalTacticalPosition | null]> = [
    [0, 0, "LW"],
    [1, 0, "LCF"],
    [2, 0, "CF"],
    [3, 0, "RCF"],
    [4, 0, "RW"],

    [0, 1, "LW"],
    [1, 1, "LAM"],
    [2, 1, "CAM"],
    [3, 1, "RAM"],
    [4, 1, "RW"],

    [0, 2, "LM"],
    [1, 2, "LCM"],
    [2, 2, "CM"],
    [3, 2, "RCM"],
    [4, 2, "RM"],

    [0, 3, "LWB"],
    [1, 3, "LDM"],
    [2, 3, "CDM"],
    [3, 3, "RDM"],
    [4, 3, "RWB"],

    [0, 4, "LB"],
    [1, 4, "LCB"],
    [2, 4, "CB"],
    [3, 4, "RCB"],
    [4, 4, "RB"],

    [0, 5, null],
    [1, 5, null],
    [2, 5, "GK"],
    [3, 5, null],
    [4, 5, null],
  ];

  for (const [gridX, gridY, expected] of cases) {
    it(`cell(${gridX},${gridY}) == ${expected}`, () => {
      expect(canonicalPositionForCell(gridX, gridY)).toBe(expected);
    });
  }

  it("returns null for out-of-range coordinates and never clamps", () => {
    expect(canonicalPositionForCell(-1, 2)).toBeNull();
    expect(canonicalPositionForCell(5, 2)).toBeNull();
    expect(canonicalPositionForCell(2, -1)).toBeNull();
    expect(canonicalPositionForCell(2, 6)).toBeNull();
    expect(canonicalPositionForCell(1.5, 2)).toBeNull();
    expect(canonicalPositionForCell(NaN, 2)).toBeNull();
  });
});

describe("every canonical position resolves from at least one cell", () => {
  for (const position of CANONICAL_TACTICAL_POSITIONS) {
    it(`${position} has at least one valid formation cell`, () => {
      expect(validFormationCellsFor(position).length).toBeGreaterThan(0);
    });
  }
});

describe("LW/RW two-cell identity (ADR-0154 §3)", () => {
  it("LW has exactly two valid cells: x0/y0 and x0/y1", () => {
    expect(validFormationCellsFor("LW")).toEqual([
      { gridX: 0, gridY: 0 },
      { gridX: 0, gridY: 1 },
    ]);
  });

  it("RW has exactly two valid cells: x4/y0 and x4/y1", () => {
    expect(validFormationCellsFor("RW")).toEqual([
      { gridX: 4, gridY: 0 },
      { gridX: 4, gridY: 1 },
    ]);
  });

  it("every other canonical position has exactly one valid cell", () => {
    for (const position of CANONICAL_TACTICAL_POSITIONS) {
      if (position === "LW" || position === "RW") continue;
      expect(validFormationCellsFor(position)).toHaveLength(1);
    }
  });

  it("LW/RW primary display cell is the forward (y0) cell, not attacking-mid (y1)", () => {
    expect(primaryDisplayCellFor("LW")).toEqual({ gridX: 0, gridY: 0 });
    expect(primaryDisplayCellFor("RW")).toEqual({ gridX: 4, gridY: 0 });
  });
});

describe("primaryDisplayCellFor", () => {
  it("every canonical position has a primary display cell that is itself a valid cell", () => {
    for (const position of CANONICAL_TACTICAL_POSITIONS) {
      const primary = primaryDisplayCellFor(position);
      const valid = validFormationCellsFor(position);
      expect(valid).toContainEqual(primary);
    }
  });

  it("round-trips through canonicalPositionForCell for every non-LW/RW position", () => {
    for (const position of CANONICAL_TACTICAL_POSITIONS) {
      if (position === "LW" || position === "RW") continue;
      const { gridX, gridY } = primaryDisplayCellFor(position);
      expect(canonicalPositionForCell(gridX, gridY)).toBe(position);
    }
  });
});
