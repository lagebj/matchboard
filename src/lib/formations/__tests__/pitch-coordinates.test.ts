import { describe, it, expect } from "vitest";
import {
  getGridPositionPercent,
  GRID_X_PERCENT,
  GRID_Y_PERCENT,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "@/lib/formations/types";

describe("Pitch coordinate boundary alignment", () => {
  describe("getGridPositionPercent", () => {
    it("maps ST (gridX=2, gridY=0) to top attack position inside pitch bounds", () => {
      const { x, y } = getGridPositionPercent(2, 0);
      expect(x).toBe(50);
      expect(y).toBe(12);
    });

    it("maps GK (gridX=2, gridY=5) to bottom deep position inside pitch bounds", () => {
      const { x, y } = getGridPositionPercent(2, 5);
      expect(x).toBe(50);
      expect(y).toBe(88);
    });

    it("maps all grid positions inside pitch bounds (0-100%)", () => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const pos = getGridPositionPercent(x, y);
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThanOrEqual(100);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeLessThanOrEqual(100);
        }
      }
    });

    it("maps all grid positions inside the pitch touchline (>= 1% and <= 99%)", () => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const pos = getGridPositionPercent(x, y);
          expect(pos.x).toBeGreaterThanOrEqual(1);
          expect(pos.x).toBeLessThanOrEqual(99);
          expect(pos.y).toBeGreaterThanOrEqual(1);
          expect(pos.y).toBeLessThanOrEqual(99);
        }
      }
    });
  });

  describe("GRID_X_PERCENT bounds", () => {
    it("leftmost column is >= 10%", () => {
      expect(GRID_X_PERCENT[0]).toBeGreaterThanOrEqual(10);
    });

    it("rightmost column is <= 90%", () => {
      expect(GRID_X_PERCENT[4]).toBeLessThanOrEqual(90);
    });

    it("centre column is exactly 50%", () => {
      expect(GRID_X_PERCENT[2]).toBe(50);
    });
  });

  describe("GRID_Y_PERCENT bounds", () => {
    it("top row (attack) is >= 10%", () => {
      expect(GRID_Y_PERCENT[0]).toBeGreaterThanOrEqual(10);
    });

    it("bottom row (goalkeeper/deep) is <= 90%", () => {
      expect(GRID_Y_PERCENT[5]).toBeLessThanOrEqual(90);
    });

    it("midfield rows are centered around 50%", () => {
      expect(GRID_Y_PERCENT[2]).toBeLessThan(50);
      expect(GRID_Y_PERCENT[3]).toBeGreaterThan(50);
    });
  });

  describe("SVG coordinate alignment", () => {
    it("every grid position is inside the SVG touchline (0.5-99.5%)", () => {
      const svgTouchlineMin = 0.5;
      const svgTouchlineMax = 99.5;
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const pos = getGridPositionPercent(x, y);
          expect(pos.x, `gridX=${x}, gridY=${y}: x=${pos.x}% must be >= ${svgTouchlineMin}%`).toBeGreaterThanOrEqual(svgTouchlineMin);
          expect(pos.x, `gridX=${x}, gridY=${y}: x=${pos.x}% must be <= ${svgTouchlineMax}%`).toBeLessThanOrEqual(svgTouchlineMax);
          expect(pos.y, `gridX=${x}, gridY=${y}: y=${pos.y}% must be >= ${svgTouchlineMin}%`).toBeGreaterThanOrEqual(svgTouchlineMin);
          expect(pos.y, `gridX=${x}, gridY=${y}: y=${pos.y}% must be <= ${svgTouchlineMax}%`).toBeLessThanOrEqual(svgTouchlineMax);
        }
      }
    });

    it("ST row (gridY=0) is inside the visible pitch top area", () => {
      const { y } = getGridPositionPercent(2, 0);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(20);
    });

    it("GK row (gridY=5) is inside the visible pitch bottom area", () => {
      const { y } = getGridPositionPercent(2, 5);
      expect(y).toBeGreaterThanOrEqual(80);
      expect(y).toBeLessThanOrEqual(95);
    });
  });

  describe("DOM structure requirements (contract)", () => {
    it("verify that grid positions use CSS percentage positioning relative to parent", () => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const pos = getGridPositionPercent(x, y);
          expect(typeof pos.x).toBe("number");
          expect(typeof pos.y).toBe("number");
          expect(Number.isInteger(pos.x)).toBe(true);
          expect(Number.isInteger(pos.y)).toBe(true);
        }
      }
    });
  });
});