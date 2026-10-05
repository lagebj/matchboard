import { describe, expect, it } from "vitest";
import { optionalPlayerPositionOptions, playerPositionOptions, playerPositionValues } from "../player-form-options";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";

describe("playerPositionValues/playerPositionOptions — canonical 24-code selector (ADR-0154 §11)", () => {
  it("exposes exactly the canonical 24-code vocabulary, no more and no fewer", () => {
    expect(playerPositionValues).toEqual(CANONICAL_TACTICAL_POSITIONS);
    expect(playerPositionOptions).toHaveLength(24);
  });

  it("never offers a legacy alias (DM/AM/ST) as a new selectable value", () => {
    const values: readonly string[] = playerPositionValues;
    expect(values).not.toContain("DM");
    expect(values).not.toContain("AM");
    expect(values).not.toContain("ST");
  });

  it("includes sided codes that the old 5-code selector never had", () => {
    const values: readonly string[] = playerPositionValues;
    for (const code of ["LCB", "RCB", "LDM", "RDM", "LCM", "RCM", "LAM", "RAM", "LCF", "RCF"]) {
      expect(values).toContain(code);
    }
  });

  it("every option's label includes the canonical full label and the code", () => {
    const lcb = playerPositionOptions.find((o) => o.value === "LCB")!;
    expect(lcb.label).toBe("Left Centre Back (LCB)");
  });

  it("optionalPlayerPositionOptions prepends a 'None' option onto the full canonical list", () => {
    expect(optionalPlayerPositionOptions[0]).toEqual({ label: "None", value: "" });
    expect(optionalPlayerPositionOptions).toHaveLength(25);
  });
});
