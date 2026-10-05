import { describe, expect, it } from "vitest";
import {
  classifyExactSuitability,
  isAutomaticallyEligibleForRole,
  type DeclaredPositions,
} from "../suitability";
import type { ExactRole, SideInput } from "../roles";
import type { SuitabilityTargetRole } from "../compatibility-projection";

function suit(primary: string, target: SuitabilityTargetRole, bestSide: SideInput = "CENTER") {
  return classifyExactSuitability({ primaryPosition: primary, bestSide }, target);
}

describe("mandatory LW example (ADR-0129 §8)", () => {
  const cases: Array<[string, ExactRole, string, boolean]> = [
    ["LW", "LW", "NATURAL", true],
    ["LM", "LW", "NATURAL", true],
    ["ST", "LW", "STRONG", true],
    ["LB", "LW", "STRONG", true],
    ["RB", "LW", "PLAUSIBLE", true],
    ["AM", "LW", "PLAUSIBLE", true],
    ["CM", "LW", "DEVELOPMENTAL", false],
    ["DM", "LW", "DEVELOPMENTAL", false],
    ["CB", "LW", "UNSUPPORTED", false],
  ];

  for (const [source, target, tier, eligible] of cases) {
    it(`${source} → ${target} is ${tier} (automatic=${eligible})`, () => {
      const result = suit(source, target);
      expect(result.tier).toBe(tier);
      expect(result.automaticallyEligible).toBe(eligible);
    });
  }

  it("RW mirrors LW", () => {
    expect(suit("RW", "RW").tier).toBe("NATURAL");
    expect(suit("RM", "RW").tier).toBe("NATURAL");
    expect(suit("ST", "RW").tier).toBe("STRONG");
    expect(suit("RB", "RW").tier).toBe("STRONG");
    expect(suit("LB", "RW").tier).toBe("PLAUSIBLE");
    expect(suit("CM", "RW").tier).toBe("DEVELOPMENTAL");
    expect(suit("CB", "RW").tier).toBe("UNSUPPORTED");
  });
});

describe("winger ordering consequences (§8)", () => {
  it("ST outranks CM for a winger and CM is not automatically eligible", () => {
    expect(suit("ST", "LW").score).toBeGreaterThan(suit("CM", "LW").score);
    expect(suit("ST", "LW").automaticallyEligible).toBe(true);
    expect(suit("CM", "LW").automaticallyEligible).toBe(false);
  });

  it("same-side full-back outranks CM for a winger", () => {
    expect(suit("LB", "LW").score).toBeGreaterThan(suit("CM", "LW").score);
    expect(suit("LB", "LW").automaticallyEligible).toBe(true);
  });

  it("opposite-side full-back stays PLAUSIBLE and still outranks CM", () => {
    const rbForLw = suit("RB", "LW");
    expect(rbForLw.tier).toBe("PLAUSIBLE");
    expect(rbForLw.automaticallyEligible).toBe(true);
    expect(rbForLw.score).toBeGreaterThan(suit("CM", "LW").score);
  });

  it("LM → LW and RM → RW are natural", () => {
    expect(suit("LM", "LW").tier).toBe("NATURAL");
    expect(suit("RM", "RW").tier).toBe("NATURAL");
  });
});

describe("declaration weighting and multi-source maximum (§5)", () => {
  it("applies 1.00 / 0.95 / 0.90 by declaration slot", () => {
    expect(classifyExactSuitability({ primaryPosition: "LW" }, "LW").score).toBe(100);
    expect(
      classifyExactSuitability({ primaryPosition: "CB", secondaryPosition: "LW" }, "LW").score,
    ).toBeCloseTo(95, 5);
    expect(
      classifyExactSuitability({ primaryPosition: "CB", tertiaryPosition: "LW" }, "LW").score,
    ).toBeCloseTo(90, 5);
  });

  it("takes the maximum across declared sources", () => {
    const result = classifyExactSuitability(
      { primaryPosition: "CB", secondaryPosition: "ST", bestSide: "CENTER" },
      "LW",
    );
    expect(result.score).toBeCloseTo(76, 5); // ST→LW 80 × 0.95
    expect(result.tier).toBe("STRONG");
  });

  it("a secondary exact-winger declaration outranks a primary ST-derived winger", () => {
    const derivedFromStriker = classifyExactSuitability({ primaryPosition: "ST", bestSide: "CENTER" }, "LW");
    const secondaryWinger = classifyExactSuitability(
      { primaryPosition: "CB", secondaryPosition: "LW", bestSide: "CENTER" },
      "LW",
    );
    expect(secondaryWinger.score).toBeGreaterThan(derivedFromStriker.score);
    expect(secondaryWinger.tier).toBe("NATURAL");
    expect(derivedFromStriker.tier).toBe("STRONG");
  });
});

describe("best-side modifier (§6)", () => {
  it("shifts an unsided source ±4 for a left/right target and can flip a tier", () => {
    expect(suit("AM", "LW", "LEFT").score).toBeCloseTo(72, 5);
    expect(suit("AM", "LW", "LEFT").tier).toBe("STRONG");
    expect(suit("AM", "LW", "RIGHT").score).toBeCloseTo(64, 5);
    expect(suit("AM", "LW", "RIGHT").tier).toBe("PLAUSIBLE");
    expect(suit("AM", "LW", "CENTER").score).toBeCloseTo(68, 5);
  });

  it("never applies to an explicitly sided source role", () => {
    expect(suit("LM", "LW", "RIGHT").score).toBe(92);
    expect(suit("LM", "LW", "LEFT").score).toBe(92);
  });

  it("never applies to a centre target", () => {
    expect(suit("AM", "AM", "LEFT").score).toBe(100);
    expect(suit("AM", "AM", "RIGHT").score).toBe(100);
  });

  it("uses an alias's explicit source-side over the player's bestSide (LCB)", () => {
    const lcbForLb = classifyExactSuitability({ primaryPosition: "LCB", bestSide: "RIGHT" }, "LB");
    expect(lcbForLb.score).toBeCloseTo(76, 5); // CB→LB 72 + same-side 4
    expect(lcbForLb.tier).toBe("STRONG");

    const lcbForRb = classifyExactSuitability({ primaryPosition: "LCB", bestSide: "LEFT" }, "RB");
    expect(lcbForRb.score).toBeCloseTo(68, 5); // CB→RB 72 − opposite-side 4
    expect(lcbForRb.tier).toBe("PLAUSIBLE");
  });
});

describe("nothing outside declared positions can create or upgrade eligibility (§5)", () => {
  it("classifyExactSuitability takes only (player, target) — no fairness/evidence knob", () => {
    expect(classifyExactSuitability.length).toBe(2);
  });

  it("an unknown declared string yields no automatic eligibility", () => {
    const result = classifyExactSuitability({ primaryPosition: "Midfielder" }, "CM");
    expect(result.score).toBe(0);
    expect(result.tier).toBe("UNSUPPORTED");
    expect(result.automaticallyEligible).toBe(false);
    expect(result.bySource[0]?.normalized.known).toBe(false);
  });

  it("no declared position at all yields UNSUPPORTED", () => {
    expect(classifyExactSuitability({ primaryPosition: null }, "CM").tier).toBe("UNSUPPORTED");
    expect(classifyExactSuitability({ primaryPosition: "" }, "CM").bySource).toHaveLength(0);
    expect(
      classifyExactSuitability({ primaryPosition: "MID", secondaryPosition: "Forward" }, "ST").score,
    ).toBe(0);
  });
});

describe("goalkeeper boundary is unchanged (§18)", () => {
  it("GK is natural for GK and unsupported for outfield", () => {
    expect(suit("GK", "GK").tier).toBe("NATURAL");
    expect(suit("GK", "CB").tier).toBe("UNSUPPORTED");
    expect(suit("GK", "CB").automaticallyEligible).toBe(false);
  });

  it("an outfield source is unsupported for GK", () => {
    expect(suit("CB", "GK").tier).toBe("UNSUPPORTED");
    expect(suit("ST", "GK").tier).toBe("UNSUPPORTED");
  });
});

describe("isAutomaticallyEligibleForRole", () => {
  it("gates on NATURAL / STRONG / PLAUSIBLE", () => {
    const lb: DeclaredPositions = { primaryPosition: "LB", bestSide: "LEFT" };
    expect(isAutomaticallyEligibleForRole(lb, "LW")).toBe(true);
    expect(isAutomaticallyEligibleForRole({ primaryPosition: "CM", bestSide: "CENTER" }, "LW")).toBe(false);
    expect(isAutomaticallyEligibleForRole({ primaryPosition: "CB", bestSide: "CENTER" }, "LW")).toBe(false);
  });
});

describe("canonical sided targets (ADR-0154 §5 compatibility projection)", () => {
  it("LCB / RCB target projects through the CB base role, same tier shape as CB", () => {
    expect(suit("CB", "LCB").tier).toBe("NATURAL");
    expect(suit("CB", "RCB").tier).toBe("NATURAL");
    expect(suit("LB", "LCB").tier).toBe(suit("LB", "CB").tier);
  });

  it("new sided targets (LDM/RDM/LCM/RCM/LAM/RAM/LCF/RCF) score through their base role", () => {
    expect(suit("DM", "LDM").tier).toBe("NATURAL");
    expect(suit("DM", "RDM").tier).toBe("NATURAL");
    expect(suit("CM", "LCM").tier).toBe("NATURAL");
    expect(suit("AM", "RAM").tier).toBe("NATURAL");
    expect(suit("ST", "LCF").tier).toBe("NATURAL"); // unsided centre-line declaration spreads to its sided siblings
  });

  it("legacy DM/AM/ST targets and their canonical replacements CDM/CAM/CF score identically", () => {
    expect(suit("CM", "DM").score).toBeCloseTo(suit("CM", "CDM").score, 5);
    expect(suit("CM", "AM").score).toBeCloseTo(suit("CM", "CAM").score, 5);
    expect(suit("AM", "ST").score).toBeCloseTo(suit("AM", "CF").score, 5);
  });
});

describe("unsided centre-line declaration spreads across its left/centre/right triple (user-clarified nuance)", () => {
  it("a declared CM is NATURAL for LCM, CM, and RCM alike", () => {
    const player: DeclaredPositions = { primaryPosition: "CM", bestSide: "CENTER" };
    expect(classifyExactSuitability(player, "LCM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "CM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RCM").tier).toBe("NATURAL");
  });

  it("a declared CB is NATURAL for LCB, CB, and RCB alike", () => {
    const player: DeclaredPositions = { primaryPosition: "CB", bestSide: "CENTER" };
    expect(classifyExactSuitability(player, "LCB").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "CB").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RCB").tier).toBe("NATURAL");
  });

  it("a declared CDM is NATURAL for LDM, CDM, and RDM alike", () => {
    const player: DeclaredPositions = { primaryPosition: "CDM", bestSide: "CENTER" };
    expect(classifyExactSuitability(player, "LDM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "CDM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RDM").tier).toBe("NATURAL");
  });

  it("a declared CAM is NATURAL for LAM, CAM, and RAM alike", () => {
    const player: DeclaredPositions = { primaryPosition: "CAM", bestSide: "CENTER" };
    expect(classifyExactSuitability(player, "LAM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "CAM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RAM").tier).toBe("NATURAL");
  });

  it("a declared CF is NATURAL for LCF, CF, and RCF alike", () => {
    const player: DeclaredPositions = { primaryPosition: "CF", bestSide: "CENTER" };
    expect(classifyExactSuitability(player, "LCF").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "CF").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RCF").tier).toBe("NATURAL");
  });
});

describe("wide sided declarations do NOT spread to their opposite side (user-clarified boundary)", () => {
  it("a declared LB is meaningfully weaker for RB than for LB — not an equivalent spread", () => {
    const player: DeclaredPositions = { primaryPosition: "LB" };
    const lb = classifyExactSuitability(player, "LB");
    const rb = classifyExactSuitability(player, "RB");
    expect(lb.tier).toBe("NATURAL");
    expect(rb.tier).not.toBe("NATURAL");
    expect(rb.score).toBeLessThan(lb.score - 10); // real cross-score gap, not a ±4 nudge
  });

  it("a declared LM is meaningfully weaker for RM than for LM", () => {
    const player: DeclaredPositions = { primaryPosition: "LM" };
    expect(classifyExactSuitability(player, "LM").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RM").tier).not.toBe("NATURAL");
  });

  it("a declared LW is meaningfully weaker for RW than for LW", () => {
    const player: DeclaredPositions = { primaryPosition: "LW" };
    expect(classifyExactSuitability(player, "LW").tier).toBe("NATURAL");
    expect(classifyExactSuitability(player, "RW").tier).not.toBe("NATURAL");
  });
});

describe("deterministic", () => {
  it("returns identical results for identical input", () => {
    const player: DeclaredPositions = { primaryPosition: "ST", secondaryPosition: "LW", bestSide: "LEFT" };
    const a = classifyExactSuitability(player, "LW");
    const b = classifyExactSuitability(player, "LW");
    expect(a).toEqual(b);
  });
});
