import { describe, expect, it } from "vitest";
import { projectToBaseRole } from "../compatibility-projection";
import { CANONICAL_TACTICAL_POSITIONS } from "../roles";

describe("projectToBaseRole — compatibility projection (ADR-0154 §5)", () => {
  it("projects every canonical code to its base role + side exactly per the addendum table", () => {
    expect(projectToBaseRole("GK")).toEqual({ baseRole: "GK", side: null });

    expect(projectToBaseRole("LB")).toEqual({ baseRole: "LB", side: "LEFT" });
    expect(projectToBaseRole("LCB")).toEqual({ baseRole: "CB", side: "LEFT" });
    expect(projectToBaseRole("CB")).toEqual({ baseRole: "CB", side: null });
    expect(projectToBaseRole("RCB")).toEqual({ baseRole: "CB", side: "RIGHT" });
    expect(projectToBaseRole("RB")).toEqual({ baseRole: "RB", side: "RIGHT" });

    expect(projectToBaseRole("LWB")).toEqual({ baseRole: "LB", side: "LEFT" });
    expect(projectToBaseRole("LDM")).toEqual({ baseRole: "DM", side: "LEFT" });
    expect(projectToBaseRole("CDM")).toEqual({ baseRole: "DM", side: null });
    expect(projectToBaseRole("RDM")).toEqual({ baseRole: "DM", side: "RIGHT" });
    expect(projectToBaseRole("RWB")).toEqual({ baseRole: "RB", side: "RIGHT" });

    expect(projectToBaseRole("LM")).toEqual({ baseRole: "LM", side: "LEFT" });
    expect(projectToBaseRole("LCM")).toEqual({ baseRole: "CM", side: "LEFT" });
    expect(projectToBaseRole("CM")).toEqual({ baseRole: "CM", side: null });
    expect(projectToBaseRole("RCM")).toEqual({ baseRole: "CM", side: "RIGHT" });
    expect(projectToBaseRole("RM")).toEqual({ baseRole: "RM", side: "RIGHT" });

    expect(projectToBaseRole("LW")).toEqual({ baseRole: "LW", side: "LEFT" });
    expect(projectToBaseRole("LAM")).toEqual({ baseRole: "AM", side: "LEFT" });
    expect(projectToBaseRole("CAM")).toEqual({ baseRole: "AM", side: null });
    expect(projectToBaseRole("RAM")).toEqual({ baseRole: "AM", side: "RIGHT" });
    expect(projectToBaseRole("RW")).toEqual({ baseRole: "RW", side: "RIGHT" });

    expect(projectToBaseRole("LCF")).toEqual({ baseRole: "ST", side: "LEFT" });
    expect(projectToBaseRole("CF")).toEqual({ baseRole: "ST", side: null });
    expect(projectToBaseRole("RCF")).toEqual({ baseRole: "ST", side: "RIGHT" });
  });

  it("every canonical position projects to a non-null result", () => {
    for (const code of CANONICAL_TACTICAL_POSITIONS) {
      expect(projectToBaseRole(code)).not.toBeNull();
    }
  });

  it("accepts the three legacy target aliases DM/AM/ST, matching their canonical replacement's projection", () => {
    expect(projectToBaseRole("DM")).toEqual(projectToBaseRole("CDM"));
    expect(projectToBaseRole("AM")).toEqual(projectToBaseRole("CAM"));
    expect(projectToBaseRole("ST")).toEqual(projectToBaseRole("CF"));
  });

  it("returns null for an unrecognized/broad value — no automatic eligibility, never invented", () => {
    expect(projectToBaseRole("MIDFIELDER")).toBeNull();
    expect(projectToBaseRole("nonsense")).toBeNull();
  });

  it("never collapses a sided code's projection onto its unsided sibling's identity", () => {
    // The projection shares a base role for compatibility scoring, but the
    // canonical identity (the input itself) is never conflated with CB —
    // this asserts the projection output, not the input, differs by side.
    expect(projectToBaseRole("LCB")!.side).not.toBe(projectToBaseRole("CB")!.side);
    expect(projectToBaseRole("RCB")!.side).not.toBe(projectToBaseRole("CB")!.side);
  });
});
