import { describe, it, expect } from "vitest";
import { exactPositionLabel, compactPositionLabel } from "../exact-position-labels";

describe("exactPositionLabel", () => {
  it("labels canonical exact codes with their full human name", () => {
    expect(exactPositionLabel("DM")).toBe("Defensive Midfield");
    expect(exactPositionLabel("ST")).toBe("Striker");
    expect(exactPositionLabel("GK")).toBe("Goalkeeper");
  });

  it("normalizes a legacy alias before labeling", () => {
    expect(exactPositionLabel("DEFENSIVE_MIDFIELDER")).toBe("Defensive Midfield");
    expect(exactPositionLabel("GOALKEEPER")).toBe("Goalkeeper");
  });

  it("labels broad historical codes broadly, not with a specific tactical label", () => {
    expect(exactPositionLabel("DEFENDER")).toBe("Defender");
    expect(exactPositionLabel("MIDFIELDER")).toBe("Midfielder");
    expect(exactPositionLabel("FORWARD")).toBe("Forward");
  });

  it("humanizes an unrecognized underscore code instead of rendering it raw", () => {
    expect(exactPositionLabel("SOME_UNKNOWN_CODE")).toBe("Some Unknown Code");
  });

  it("never renders raw SCREAMING_SNAKE_CASE for a known legacy alias", () => {
    expect(exactPositionLabel("DEFENSIVE_MIDFIELDER")).not.toMatch(/_/);
  });
});

describe("compactPositionLabel", () => {
  it("keeps exact codes compact", () => {
    expect(compactPositionLabel("DM")).toBe("DM");
    expect(compactPositionLabel("ST")).toBe("ST");
  });

  it("normalizes a legacy alias to its compact exact code", () => {
    expect(compactPositionLabel("DEFENSIVE_MIDFIELDER")).toBe("DM");
    expect(compactPositionLabel("GOALKEEPER")).toBe("GK");
  });

  it("renders broad codes as a human broad label, not a specific code", () => {
    expect(compactPositionLabel("DEFENDER")).toBe("Defender");
    expect(compactPositionLabel("FORWARD")).toBe("Forward");
  });

  it("humanizes an unrecognized code instead of rendering it raw", () => {
    expect(compactPositionLabel("WEIRD_LEGACY_VALUE")).toBe("Weird Legacy Value");
  });
});
