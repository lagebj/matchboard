import { describe, it, expect } from "vitest";
import { getGridPositionPercent, GRID_X_PERCENT, GRID_Y_PERCENT } from "../types";

describe("getGridPositionPercent", () => {
  it("returns correct position for (2, 0) — ST at top centre", () => {
    const pos = getGridPositionPercent(2, 0);
    expect(pos.x).toBe(GRID_X_PERCENT[2]);
    expect(pos.y).toBe(GRID_Y_PERCENT[0]);
    expect(pos.y).toBe(12);
  });

  it("returns correct position for (2, 5) — GK at bottom centre", () => {
    const pos = getGridPositionPercent(2, 5);
    expect(pos.x).toBe(GRID_X_PERCENT[2]);
    expect(pos.y).toBe(GRID_Y_PERCENT[5]);
    expect(pos.y).toBe(88);
  });

  it("ST at y=12% is within pitch surface (below 0%, above 100%)", () => {
    const pos = getGridPositionPercent(2, 0);
    expect(pos.y).toBeGreaterThanOrEqual(5);
    expect(pos.y).toBeLessThanOrEqual(95);
  });

  it("GK at y=88% is within pitch surface", () => {
    const pos = getGridPositionPercent(2, 5);
    expect(pos.y).toBeGreaterThanOrEqual(5);
    expect(pos.y).toBeLessThanOrEqual(95);
  });

  it("returns 50 for unknown gridX", () => {
    const pos = getGridPositionPercent(99, 0);
    expect(pos.x).toBe(50);
  });

  it("returns 50 for unknown gridY", () => {
    const pos = getGridPositionPercent(0, 99);
    expect(pos.y).toBe(50);
  });

  it("no slot renders outside the pitch surface (all coordinates between 10% and 90%)", () => {
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 5; y++) {
        const pos = getGridPositionPercent(x, y);
        expect(pos.x).toBeGreaterThanOrEqual(10);
        expect(pos.x).toBeLessThanOrEqual(90);
        expect(pos.y).toBeGreaterThanOrEqual(10);
        expect(pos.y).toBeLessThanOrEqual(90);
      }
    }
  });
});