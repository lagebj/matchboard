import { describe, it, expect } from "vitest";
import {
  getBoardPositionPercent,
  type BoardProjectionOptions,
} from "../board-projection";
import { GRID_X_PERCENT, GRID_Y_PERCENT } from "../types";

describe("getBoardPositionPercent", () => {
  describe("vertical orientation (default legacy)", () => {
    it("returns the same values as getGridPositionPercent for all positions", () => {
      for (let x = 0; x <= 4; x++) {
        for (let y = 0; y <= 5; y++) {
          const pos = getBoardPositionPercent(x, y, {
            orientation: "vertical",
          });
          expect(pos.x).toBe(GRID_X_PERCENT[x]);
          expect(pos.y).toBe(GRID_Y_PERCENT[y]);
        }
      }
    });

    it("maps GK (gridX=2, gridY=5) to bottom centre in vertical layout", () => {
      const pos = getBoardPositionPercent(2, 5, {
        orientation: "vertical",
      });
      expect(pos.x).toBe(50);
      expect(pos.y).toBe(88);
    });

    it("maps ST (gridX=2, gridY=0) to top centre in vertical layout", () => {
      const pos = getBoardPositionPercent(2, 0, {
        orientation: "vertical",
      });
      expect(pos.x).toBe(50);
      expect(pos.y).toBe(12);
    });
  });

  describe("horizontal left-to-right (default orientation)", () => {
    it("maps GK to left side (depth maps to x-axis)", () => {
      const pos = getBoardPositionPercent(2, 5, {
        orientation: "horizontal",
        attackingDirection: "left-to-right",
      });
      expect(pos.x).toBe(GRID_Y_PERCENT[5]);
      expect(pos.y).toBe(100 - GRID_X_PERCENT[2]);
    });

    it("maps ST to right side (attack maps to x-axis)", () => {
      const pos = getBoardPositionPercent(2, 0, {
        orientation: "horizontal",
        attackingDirection: "left-to-right",
      });
      expect(pos.x).toBe(GRID_Y_PERCENT[0]);
      expect(pos.y).toBe(100 - GRID_X_PERCENT[2]);
    });

    it("maps left wide defender (gridX=0, gridY=4) to near bottom-left", () => {
      const pos = getBoardPositionPercent(0, 4, {
        orientation: "horizontal",
        attackingDirection: "left-to-right",
      });
      expect(pos.x).toBe(GRID_Y_PERCENT[4]);
      expect(pos.y).toBe(100 - GRID_X_PERCENT[0]);
    });

    it("maps all positions inside pitch bounds (1-99%) for horizontal layout", () => {
      for (let x = 0; x <= 4; x++) {
        for (let y = 0; y <= 5; y++) {
          const pos = getBoardPositionPercent(x, y, {
            orientation: "horizontal",
            attackingDirection: "left-to-right",
          });
          expect(pos.x).toBeGreaterThanOrEqual(1);
          expect(pos.x).toBeLessThanOrEqual(99);
          expect(pos.y).toBeGreaterThanOrEqual(1);
          expect(pos.y).toBeLessThanOrEqual(99);
        }
      }
    });
  });

  describe("horizontal right-to-left", () => {
    it("maps GK to right side (depth maps to inverted x-axis)", () => {
      const pos = getBoardPositionPercent(2, 5, {
        orientation: "horizontal",
        attackingDirection: "right-to-left",
      });
      expect(pos.x).toBe(100 - GRID_Y_PERCENT[5]);
      expect(pos.y).toBe(100 - GRID_X_PERCENT[2]);
    });

    it("maps ST to left side (attack maps to inverted x-axis)", () => {
      const pos = getBoardPositionPercent(2, 0, {
        orientation: "horizontal",
        attackingDirection: "right-to-left",
      });
      expect(pos.x).toBe(100 - GRID_Y_PERCENT[0]);
      expect(pos.y).toBe(100 - GRID_X_PERCENT[2]);
    });

    it("maps all positions inside pitch bounds for right-to-left layout", () => {
      for (let x = 0; x <= 4; x++) {
        for (let y = 0; y <= 5; y++) {
          const pos = getBoardPositionPercent(x, y, {
            orientation: "horizontal",
            attackingDirection: "right-to-left",
          });
          expect(pos.x).toBeGreaterThanOrEqual(1);
          expect(pos.x).toBeLessThanOrEqual(99);
          expect(pos.y).toBeGreaterThanOrEqual(1);
          expect(pos.y).toBeLessThanOrEqual(99);
        }
      }
    });
  });

  describe("defaults", () => {
    it("defaults to horizontal left-to-right when no options provided", () => {
      const pos = getBoardPositionPercent(2, 5);
      const explicit = getBoardPositionPercent(2, 5, {
        orientation: "horizontal",
        attackingDirection: "left-to-right",
      });
      expect(pos.x).toBe(explicit.x);
      expect(pos.y).toBe(explicit.y);
    });

    it("returns 50 for unknown gridX", () => {
      const pos = getBoardPositionPercent(99, 0, {
        orientation: "horizontal",
      });
      expect(pos.y).toBe(50);
    });

    it("returns 50 for unknown gridY", () => {
      const pos = getBoardPositionPercent(0, 99, {
        orientation: "horizontal",
      });
      expect(pos.x).toBe(50);
    });
  });
});