import { describe, it, expect } from "vitest";
import { positionCodeToGridCell, positionCodeToPoint } from "../position-coordinates";

/**
 * Matchboard Players Operating Surface bundle, `03_POSITION_MODEL_AND_LABEL_CONTRACT.md §5`:
 * broad historical positions (DEFENDER/MIDFIELDER/FORWARD) can be placed on the canonical
 * position map, using a central zone since a broad declaration carries no left/right precision.
 */
describe("positionCodeToPoint broad historical zones", () => {
  it("places DEFENDER on the map", () => {
    expect(positionCodeToPoint("DEFENDER")).not.toBeNull();
  });

  it("places MIDFIELDER on the map", () => {
    expect(positionCodeToPoint("MIDFIELDER")).not.toBeNull();
  });

  it("places FORWARD on the map", () => {
    expect(positionCodeToPoint("FORWARD")).not.toBeNull();
  });

  it("returns null for a genuinely unknown code", () => {
    expect(positionCodeToPoint("SWEEPER")).toBeNull();
  });
});

describe("positionCodeToGridCell — thin adapter over the domain authority (ADR-0154 §4)", () => {
  it("places every canonical sided code at its own distinct cell, never collapsed to its unsided sibling", () => {
    expect(positionCodeToGridCell("LCB")).toEqual({ gridX: 1, gridY: 4 });
    expect(positionCodeToGridCell("CB")).toEqual({ gridX: 2, gridY: 4 });
    expect(positionCodeToGridCell("RCB")).toEqual({ gridX: 3, gridY: 4 });
    expect(positionCodeToGridCell("LCB")).not.toEqual(positionCodeToGridCell("CB"));
  });

  it("resolves legacy aliases to their canonical cell", () => {
    expect(positionCodeToGridCell("DM")).toEqual(positionCodeToGridCell("CDM"));
    expect(positionCodeToGridCell("GOALKEEPER")).toEqual(positionCodeToGridCell("GK"));
  });

  it("places LW/RW at their primary (forward-row) display cell", () => {
    expect(positionCodeToGridCell("LW")).toEqual({ gridX: 0, gridY: 0 });
    expect(positionCodeToGridCell("RW")).toEqual({ gridX: 4, gridY: 0 });
  });

  it("places broad historical codes on the central column, unchanged from the legacy table", () => {
    expect(positionCodeToGridCell("DEFENDER")).toEqual({ gridX: 2, gridY: 4 });
    expect(positionCodeToGridCell("MIDFIELDER")).toEqual({ gridX: 2, gridY: 2 });
    expect(positionCodeToGridCell("FORWARD")).toEqual({ gridX: 2, gridY: 0 });
    expect(positionCodeToGridCell("W")).toEqual({ gridX: 1, gridY: 0 });
    expect(positionCodeToGridCell("WM")).toEqual({ gridX: 1, gridY: 1 });
  });

  it("returns null for a genuinely unknown code", () => {
    expect(positionCodeToGridCell("SWEEPER")).toBeNull();
  });
});
