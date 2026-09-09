import { describe, expect, it } from "vitest";
import { deriveExactTargetRole, slotHasExactAutomaticTarget } from "../slot-target";

// gridX lanes (laneFromGridX): 0–1 LEFT, 2 CENTRE, 3–4 RIGHT.

describe("deriveExactTargetRole — roleType + lane, never labels (ADR-0129 §4)", () => {
  it("GOALKEEPER is GK in every lane", () => {
    expect(deriveExactTargetRole("GOALKEEPER", 0)).toBe("GK");
    expect(deriveExactTargetRole("GOALKEEPER", 2)).toBe("GK");
    expect(deriveExactTargetRole("GOALKEEPER", 4)).toBe("GK");
  });

  it("DEFENDER splits LB / CB / RB by lane", () => {
    expect(deriveExactTargetRole("DEFENDER", 0)).toBe("LB");
    expect(deriveExactTargetRole("DEFENDER", 1)).toBe("LB");
    expect(deriveExactTargetRole("DEFENDER", 2)).toBe("CB");
    expect(deriveExactTargetRole("DEFENDER", 3)).toBe("RB");
    expect(deriveExactTargetRole("DEFENDER", 4)).toBe("RB");
  });

  it("DEFENSIVE_MIDFIELDER is DM in every lane", () => {
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 0)).toBe("DM");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 2)).toBe("DM");
    expect(deriveExactTargetRole("DEFENSIVE_MIDFIELDER", 4)).toBe("DM");
  });

  it("MIDFIELDER splits LM / CM / RM by lane", () => {
    expect(deriveExactTargetRole("MIDFIELDER", 0)).toBe("LM");
    expect(deriveExactTargetRole("MIDFIELDER", 2)).toBe("CM");
    expect(deriveExactTargetRole("MIDFIELDER", 4)).toBe("RM");
  });

  it("ATTACKING_MIDFIELDER splits LW / AM / RW by lane", () => {
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 0)).toBe("LW");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 2)).toBe("AM");
    expect(deriveExactTargetRole("ATTACKING_MIDFIELDER", 4)).toBe("RW");
  });

  it("FORWARD splits LW / ST / RW by lane", () => {
    expect(deriveExactTargetRole("FORWARD", 0)).toBe("LW");
    expect(deriveExactTargetRole("FORWARD", 2)).toBe("ST");
    expect(deriveExactTargetRole("FORWARD", 4)).toBe("RW");
  });

  it("FREE derives no automatic target role (manual-only)", () => {
    expect(deriveExactTargetRole("FREE", 0)).toBeNull();
    expect(deriveExactTargetRole("FREE", 2)).toBeNull();
    expect(deriveExactTargetRole("FREE", 4)).toBeNull();
    expect(slotHasExactAutomaticTarget("FREE", 2)).toBe(false);
  });

  it("slotHasExactAutomaticTarget is true for every non-FREE role", () => {
    expect(slotHasExactAutomaticTarget("MIDFIELDER", 2)).toBe(true);
    expect(slotHasExactAutomaticTarget("GOALKEEPER", 0)).toBe(true);
  });
});
