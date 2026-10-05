import { describe, expect, it } from "vitest";
import { suggestSlotDefaults } from "../slot-defaults";

describe("suggestSlotDefaults — exact cell, not a 3-lane collapse (ADR-0154 §9)", () => {
  it("defence row (y4): five distinct labels LB/LCB/CB/RCB/RB", () => {
    const labels = [0, 1, 2, 3, 4].map((x) => suggestSlotDefaults(x, 4, "SEVEN_A_SIDE").shortLabel);
    expect(labels).toEqual(["LB", "LCB", "CB", "RCB", "RB"]);
  });

  it("defensive-mid row (y3): LWB/LDM/CDM/RDM/RWB — the outer lanes are wing-backs, not DM", () => {
    const labels = [0, 1, 2, 3, 4].map((x) => suggestSlotDefaults(x, 3, "SEVEN_A_SIDE").shortLabel);
    expect(labels).toEqual(["LWB", "LDM", "CDM", "RDM", "RWB"]);
  });

  it("midfield row (y2): LM/LCM/CM/RCM/RM", () => {
    const labels = [0, 1, 2, 3, 4].map((x) => suggestSlotDefaults(x, 2, "SEVEN_A_SIDE").shortLabel);
    expect(labels).toEqual(["LM", "LCM", "CM", "RCM", "RM"]);
  });

  it("attacking-mid row (y1): LW/LAM/CAM/RAM/RW — the outer lanes are wingers, not AM", () => {
    const labels = [0, 1, 2, 3, 4].map((x) => suggestSlotDefaults(x, 1, "SEVEN_A_SIDE").shortLabel);
    expect(labels).toEqual(["LW", "LAM", "CAM", "RAM", "RW"]);
  });

  it("attack row (y0): LW/LCF/CF/RCF/RW", () => {
    const labels = [0, 1, 2, 3, 4].map((x) => suggestSlotDefaults(x, 0, "SEVEN_A_SIDE").shortLabel);
    expect(labels).toEqual(["LW", "LCF", "CF", "RCF", "RW"]);
  });

  it("goalkeeper cell (x2/y5) is GK for every non-3v3 format", () => {
    expect(suggestSlotDefaults(2, 5, "SEVEN_A_SIDE").shortLabel).toBe("GK");
    expect(suggestSlotDefaults(2, 5, "SEVEN_A_SIDE").roleType).toBe("GOALKEEPER");
  });

  it("roleType agrees with the derived exact position's depth at every lane", () => {
    for (const [gridY, expected] of [
      [0, "FORWARD"],
      [1, "ATTACKING_MIDFIELDER"],
      [2, "MIDFIELDER"],
      [3, "DEFENSIVE_MIDFIELDER"],
      [4, "DEFENDER"],
    ] as const) {
      for (let gridX = 0; gridX <= 4; gridX++) {
        expect(suggestSlotDefaults(gridX, gridY, "ELEVEN_A_SIDE").roleType).toBe(expected);
      }
    }
  });

  it("3v3 keeps its own flavoured terminology unchanged", () => {
    expect(suggestSlotDefaults(0, 4, "THREE_A_SIDE").shortLabel).toBe("LD");
    expect(suggestSlotDefaults(0, 4, "THREE_A_SIDE").label).toBe("Left deep");
    expect(suggestSlotDefaults(2, 0, "THREE_A_SIDE").shortLabel).toBe("ST");
  });
});
