import { describe, expect, it } from "vitest";
import {
  FIT_TIER_LABEL,
  UNSUPPORTED_CONFIRMATION,
  developmentalAnnotation,
  fitLabel,
  requiresUnsupportedConfirmation,
} from "../labels";

describe("neutral fit labels (ADR-0129 §15)", () => {
  it("uses the approved wording for every tier", () => {
    expect(FIT_TIER_LABEL).toEqual({
      NATURAL: "Natural fit",
      STRONG: "Strong fit",
      PLAUSIBLE: "Plausible fit",
      DEVELOPMENTAL: "Developmental positional fit",
      UNSUPPORTED: "Outside automatic fit",
    });
    expect(fitLabel("DEVELOPMENTAL")).toBe("Developmental positional fit");
  });

  it("never uses player-value language", () => {
    const banned = ["weak player", "bad position", "harmful", "poor player", "not good enough"];
    const allText = [
      ...Object.values(FIT_TIER_LABEL),
      developmentalAnnotation(),
      UNSUPPORTED_CONFIRMATION.title,
      UNSUPPORTED_CONFIRMATION.body("Sam Rivera", "LW"),
    ]
      .join(" ")
      .toLowerCase();
    for (const phrase of banned) {
      expect(allText).not.toContain(phrase);
    }
  });
});

describe("manual-assignment confirmation boundary (§15)", () => {
  it("only UNSUPPORTED requires an explicit confirmation", () => {
    expect(requiresUnsupportedConfirmation("UNSUPPORTED")).toBe(true);
    expect(requiresUnsupportedConfirmation("DEVELOPMENTAL")).toBe(false);
    expect(requiresUnsupportedConfirmation("PLAUSIBLE")).toBe(false);
    expect(requiresUnsupportedConfirmation("NATURAL")).toBe(false);
  });

  it("confirmation copy is the approved text with player and role substituted", () => {
    expect(UNSUPPORTED_CONFIRMATION.title).toBe("Use outside automatic positional fit?");
    expect(UNSUPPORTED_CONFIRMATION.cancelLabel).toBe("Cancel");
    expect(UNSUPPORTED_CONFIRMATION.confirmLabel).toBe("Assign anyway");
    const body = UNSUPPORTED_CONFIRMATION.body("Sam Rivera", "LW");
    expect(body).toContain("Sam Rivera");
    expect(body).toContain("LW");
    expect(body).toContain("You can still make this coaching decision.");
  });
});
