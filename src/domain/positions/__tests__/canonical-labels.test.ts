import { describe, expect, it } from "vitest";
import { canonicalCompactLabel, canonicalFullLabel } from "../canonical-labels";
import { CANONICAL_TACTICAL_POSITIONS } from "../roles";

describe("canonicalFullLabel (ADR-0154 §1)", () => {
  it("matches the addendum's full labels exactly", () => {
    expect(canonicalFullLabel("GK")).toBe("Goalkeeper");
    expect(canonicalFullLabel("LCB")).toBe("Left Centre Back");
    expect(canonicalFullLabel("RCB")).toBe("Right Centre Back");
    expect(canonicalFullLabel("CDM")).toBe("Centre Defensive Midfield");
    expect(canonicalFullLabel("LDM")).toBe("Left Defensive Midfield");
    expect(canonicalFullLabel("RDM")).toBe("Right Defensive Midfield");
    expect(canonicalFullLabel("LWB")).toBe("Left Wing Back");
    expect(canonicalFullLabel("RWB")).toBe("Right Wing Back");
    expect(canonicalFullLabel("CAM")).toBe("Central Attacking Midfield");
    expect(canonicalFullLabel("LAM")).toBe("Left Attacking Midfield");
    expect(canonicalFullLabel("RAM")).toBe("Right Attacking Midfield");
    expect(canonicalFullLabel("LW")).toBe("Left Wing");
    expect(canonicalFullLabel("RW")).toBe("Right Wing");
    expect(canonicalFullLabel("CF")).toBe("Central Forward");
    expect(canonicalFullLabel("LCF")).toBe("Left Central Forward");
    expect(canonicalFullLabel("RCF")).toBe("Right Central Forward");
  });

  it("has a full label for every canonical position", () => {
    for (const code of CANONICAL_TACTICAL_POSITIONS) {
      expect(canonicalFullLabel(code)).toBeTruthy();
    }
  });

  it("normalizes legacy aliases before labelling", () => {
    expect(canonicalFullLabel("DM")).toBe(canonicalFullLabel("CDM"));
    expect(canonicalFullLabel("DEFENSIVE_MIDFIELDER")).toBe(canonicalFullLabel("CDM"));
  });

  it("keeps broad codes broad, never upgraded to exact", () => {
    expect(canonicalFullLabel("MIDFIELDER")).toBe("Midfielder");
    expect(canonicalFullLabel("DEFENDER")).toBe("Defender");
  });

  it("humanizes an unrecognized code instead of rendering raw SCREAMING_SNAKE_CASE", () => {
    expect(canonicalFullLabel("SWEEPER_KEEPER")).toBe("Sweeper Keeper");
  });
});

describe("canonicalCompactLabel (ADR-0154 §18 — compact label = canonical code)", () => {
  it("every canonical code's compact label is itself", () => {
    for (const code of CANONICAL_TACTICAL_POSITIONS) {
      expect(canonicalCompactLabel(code)).toBe(code);
    }
  });

  it("sided codes keep their own compact label, never the unsided sibling's", () => {
    expect(canonicalCompactLabel("LCB")).toBe("LCB");
    expect(canonicalCompactLabel("LCB")).not.toBe("CB");
  });

  it("broad codes render human, not as a code", () => {
    expect(canonicalCompactLabel("DEFENDER")).toBe("Defender");
  });
});
