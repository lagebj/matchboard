import { describe, expect, it } from "vitest";
import { deriveExactTargetRole, slotHasExactAutomaticTarget } from "../slot-target";

// Normative grid (ADR-0154 §2): gridX 0-4 (left→right), gridY 0-5 (attack→goalkeeper).
// deriveExactTargetRole now derives from the real cell, not roleType + a 3-lane gridX
// compression — every lane (not just LEFT/CENTRE/RIGHT) resolves to its own exact code.

describe("deriveExactTargetRole — grid cell, validated against roleType (ADR-0154 §8)", () => {
  it("GOALKEEPER at the GK cell (x2/y5) is GK", () => {
    expect(deriveExactTargetRole("GOALKEEPER", 2, 5)).toBe("GK");
  });

  it("DEFENDER splits LB/LCB/CB/RCB/RB across all five lanes at y4", () => {
    expect(deriveExactTargetRole("DEFENDER", 0, 4)).toBe("LB");
    expect(deriveExactTargetRole("DEFENDER", 1, 4)).toBe("LCB");
    expect(deriveExactTargetRole("DEFENDER", 2, 4)).toBe("CB");
    expect(deriveExactTargetRole("DEFENDER", 3, 4)).toBe("RCB");
    expect(deriveExactTargetRole("DEFENDER", 4, 4)).toBe("RB");
  });

  it("DEFENSIVE_MIDFIELDER splits LWB/LDM/CDM/RDM/RWB across all five lanes at y3", () => {
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 0, 3)).toBe("LWB");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 1, 3)).toBe("LDM");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 2, 3)).toBe("CDM");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 3, 3)).toBe("RDM");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 4, 3)).toBe("RWB");
  });

  it("MIDFIELDER splits LM/LCM/CM/RCM/RM across all five lanes at y2", () => {
    expect(deriveExactTargetRole("MIDFIELDER", 0, 2)).toBe("LM");
    expect(deriveExactTargetRole("MIDFIELDER", 1, 2)).toBe("LCM");
    expect(deriveExactTargetRole("MIDFIELDER", 2, 2)).toBe("CM");
    expect(deriveExactTargetRole("MIDFIELDER", 3, 2)).toBe("RCM");
    expect(deriveExactTargetRole("MIDFIELDER", 4, 2)).toBe("RM");
  });

  it("ATTACKING_MIDFIELDER splits LW/LAM/CAM/RAM/RW across all five lanes at y1", () => {
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 0, 1)).toBe("LW");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 1, 1)).toBe("LAM");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 2, 1)).toBe("CAM");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 3, 1)).toBe("RAM");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 4, 1)).toBe("RW");
  });

  it("FORWARD splits LW/LCF/CF/RCF/RW across all five lanes at y0", () => {
    expect(deriveExactTargetRole("FORWARD", 0, 0)).toBe("LW");
    expect(deriveExactTargetRole("FORWARD", 1, 0)).toBe("LCF");
    expect(deriveExactTargetRole("FORWARD", 2, 0)).toBe("CF");
    expect(deriveExactTargetRole("FORWARD", 3, 0)).toBe("RCF");
    expect(deriveExactTargetRole("FORWARD", 4, 0)).toBe("RW");
  });

  it("FREE derives no automatic target role (manual-only)", () => {
    expect(deriveExactTargetRole("FREE", 0, 4)).toBeNull();
    expect(deriveExactTargetRole("FREE", 2, 2)).toBeNull();
    expect(deriveExactTargetRole("FREE", 4, 0)).toBeNull();
    expect(slotHasExactAutomaticTarget("FREE", 2, 2)).toBe(false);
  });

  it("slotHasExactAutomaticTarget is true for every non-FREE role on a consistent cell", () => {
    expect(slotHasExactAutomaticTarget("MIDFIELDER", 2, 2)).toBe(true);
    expect(slotHasExactAutomaticTarget("GOALKEEPER", 2, 5)).toBe(true);
  });

  it("LW/RW derive from either of their two valid cells (y0 attack or y1 attacking-mid)", () => {
    expect(deriveExactTargetRole("FORWARD", 0, 0)).toBe("LW");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 0, 1)).toBe("LW");
    expect(deriveExactTargetRole("FORWARD", 4, 0)).toBe("RW");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 4, 1)).toBe("RW");
  });

  it("a non-position y5 cell (anything but x2) derives no target regardless of roleType", () => {
    expect(deriveExactTargetRole("DEFENDER", 0, 5)).toBeNull();
    expect(deriveExactTargetRole("DEFENDER", 4, 5)).toBeNull();
  });

  describe("roleType/cell depth contradiction derives no target, never silently resolved (§8)", () => {
    it("a MIDFIELDER roleType slot placed on the defence row (y4) derives null", () => {
      expect(deriveExactTargetRole("MIDFIELDER", 2, 4)).toBeNull();
    });

    it("a DEFENDER roleType slot placed on the goalkeeper cell derives null", () => {
      expect(deriveExactTargetRole("DEFENDER", 2, 5)).toBeNull();
    });

    it("a GOALKEEPER roleType slot placed off the GK cell derives null", () => {
      expect(deriveExactTargetRole("GOALKEEPER", 0, 4)).toBeNull();
    });

    it("a FORWARD roleType slot placed on the midfield row (y2) derives null", () => {
      expect(deriveExactTargetRole("FORWARD", 2, 2)).toBeNull();
    });
  });
});
