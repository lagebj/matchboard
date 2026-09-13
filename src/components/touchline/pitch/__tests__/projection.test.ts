import { describe, it, expect } from "vitest";
import {
  projectPlanningPitchPoint,
  gridToNormalizedPoint,
  normalizedPointToGrid,
  PLANNING_PITCH_PERSPECTIVE,
} from "../projection";

describe("projection — orientation (contract §2: GK bottom, attack top, no home/away mirroring)", () => {
  it("own goal (longitudinal 0) projects to the bottom edge (high yPct)", () => {
    expect(projectPlanningPitchPoint({ lateral: 0.5, longitudinal: 0 }).yPct).toBeCloseTo(100);
  });

  it("attacking goal (longitudinal 1) projects to the top edge (low yPct)", () => {
    expect(projectPlanningPitchPoint({ lateral: 0.5, longitudinal: 1 }).yPct).toBeCloseTo(0);
  });

  it("a goalkeeper grid cell (gridY=5) resolves to longitudinal 0 (own goal)", () => {
    const point = gridToNormalizedPoint(2, 5);
    expect(point.longitudinal).toBeCloseTo(0.12, 1);
  });

  it("a striker grid cell (gridY=0) resolves to longitudinal close to 1 (attacking end)", () => {
    const point = gridToNormalizedPoint(2, 0);
    expect(point.longitudinal).toBeGreaterThan(point.longitudinal - 0.01);
    expect(point.longitudinal).toBeCloseTo(0.88, 1);
  });

  it("lateral is never flipped: left grid column stays left, right stays right, regardless of longitudinal", () => {
    const left = projectPlanningPitchPoint({ lateral: 0.1, longitudinal: 0.3 });
    const right = projectPlanningPitchPoint({ lateral: 0.9, longitudinal: 0.3 });
    expect(left.xPct).toBeLessThan(right.xPct);

    const leftAttack = projectPlanningPitchPoint({ lateral: 0.1, longitudinal: 0.9 });
    const rightAttack = projectPlanningPitchPoint({ lateral: 0.9, longitudinal: 0.9 });
    expect(leftAttack.xPct).toBeLessThan(rightAttack.xPct);
  });
});

describe("projection — planning pitch trapezoid (contract §5)", () => {
  it("the top edge is narrower than the bottom edge", () => {
    const bottomLeft = projectPlanningPitchPoint({ lateral: 0, longitudinal: 0 });
    const bottomRight = projectPlanningPitchPoint({ lateral: 1, longitudinal: 0 });
    const topLeft = projectPlanningPitchPoint({ lateral: 0, longitudinal: 1 });
    const topRight = projectPlanningPitchPoint({ lateral: 1, longitudinal: 1 });

    const bottomWidth = bottomRight.xPct - bottomLeft.xPct;
    const topWidth = topRight.xPct - topLeft.xPct;

    expect(topWidth).toBeLessThan(bottomWidth);
    expect(topWidth / bottomWidth).toBeCloseTo(PLANNING_PITCH_PERSPECTIVE.topWidthFraction, 5);
  });

  it("both edges stay centered on xPct 50", () => {
    const bottomLeft = projectPlanningPitchPoint({ lateral: 0, longitudinal: 0 });
    const bottomRight = projectPlanningPitchPoint({ lateral: 1, longitudinal: 0 });
    const topLeft = projectPlanningPitchPoint({ lateral: 0, longitudinal: 1 });
    const topRight = projectPlanningPitchPoint({ lateral: 1, longitudinal: 1 });

    expect((bottomLeft.xPct + bottomRight.xPct) / 2).toBeCloseTo(50);
    expect((topLeft.xPct + topRight.xPct) / 2).toBeCloseTo(50);
  });

  it("token scale is 1.0 near the own goal and reduces toward the attacking goal, within the tuning range", () => {
    const nearGoal = projectPlanningPitchPoint({ lateral: 0.5, longitudinal: 0 });
    const nearAttack = projectPlanningPitchPoint({ lateral: 0.5, longitudinal: 1 });

    expect(nearGoal.perspectiveScale).toBeCloseTo(PLANNING_PITCH_PERSPECTIVE.scaleNearGoal);
    expect(nearAttack.perspectiveScale).toBeCloseTo(PLANNING_PITCH_PERSPECTIVE.scaleNearAttack);
    expect(nearAttack.perspectiveScale).toBeLessThan(nearGoal.perspectiveScale);
    expect(nearAttack.perspectiveScale).toBeGreaterThanOrEqual(0.9);
    expect(nearAttack.perspectiveScale).toBeLessThanOrEqual(0.94);
  });

  it("scale and width narrow monotonically as longitudinal increases (no reversal partway up the pitch)", () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map((longitudinal) => projectPlanningPitchPoint({ lateral: 1, longitudinal }));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].perspectiveScale).toBeLessThanOrEqual(samples[i - 1].perspectiveScale);
      expect(samples[i].xPct).toBeLessThanOrEqual(samples[i - 1].xPct);
    }
  });
});

describe("grid <-> normalized point round-trip", () => {
  it("round-trips every formation grid cell back to itself", () => {
    for (let gridX = 0; gridX < 5; gridX++) {
      for (let gridY = 0; gridY < 6; gridY++) {
        const point = gridToNormalizedPoint(gridX, gridY);
        const back = normalizedPointToGrid(point);
        expect(back).toEqual({ gridX, gridY });
      }
    }
  });
});
