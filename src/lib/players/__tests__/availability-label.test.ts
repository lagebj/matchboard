import { describe, it, expect } from "vitest";
import { availabilityLabel } from "../availability-label";

describe("availabilityLabel", () => {
  it("formats every known availability status", () => {
    expect(availabilityLabel("AVAILABLE")).toBe("Available");
    expect(availabilityLabel("INJURED")).toBe("Injured");
    expect(availabilityLabel("SICK")).toBe("Sick");
    expect(availabilityLabel("AWAY")).toBe("Away");
    expect(availabilityLabel("TENTATIVE")).toBe("Tentative");
    expect(availabilityLabel("UNKNOWN")).toBe("Unknown");
  });

  it("falls back to the raw status string for an unrecognised value", () => {
    expect(availabilityLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
