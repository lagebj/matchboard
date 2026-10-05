import { describe, expect, it } from "vitest";
import { zoneForCoordinate } from "../spatial-grid";

describe("zoneForCoordinate — 5x6 spatial grid (ADR-0155 §3)", () => {
  it("maps the origin corner to D1_L1", () => {
    expect(zoneForCoordinate(0, 0)).toBe("D1_L1");
  });

  it("maps the far corner to D6_L5", () => {
    expect(zoneForCoordinate(1, 1)).toBe("D6_L5");
  });

  it("sends an exact internal depth boundary to the higher band", () => {
    // 0.5 = 3/6, the boundary between D3=[2/6,3/6) and D4=[3/6,4/6).
    expect(zoneForCoordinate(0.5, 0)).toBe("D4_L1");
  });

  it("sends an exact internal lane boundary to the higher band", () => {
    // 0.4 = 2/5, the boundary between L2=[1/5,2/5) and L3=[2/5,3/5).
    expect(zoneForCoordinate(0, 0.4)).toBe("D1_L3");
  });

  it("sends the last-band lower boundary (5/6, 4/5) to the final band on each axis", () => {
    expect(zoneForCoordinate(5 / 6, 4 / 5)).toBe("D6_L5");
  });

  it.each([
    ["NaN x", Number.NaN, 0],
    ["NaN y", 0, Number.NaN],
    ["negative x", -0.1, 0],
    ["negative y", 0, -0.1],
    ["x above 1", 1.1, 0],
    ["y above 1", 0, 1.1],
    ["null x", null, 0],
    ["null y", 0, null],
    ["undefined x", undefined, 0],
  ])("returns no zone for %s", (_label, x, y) => {
    expect(zoneForCoordinate(x as number | null, y as number | null)).toBeNull();
  });

  it("never clamps an out-of-range coordinate onto the pitch", () => {
    expect(zoneForCoordinate(2, 2)).toBeNull();
    expect(zoneForCoordinate(-1, -1)).toBeNull();
  });
});
