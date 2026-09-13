import { describe, it, expect } from "vitest";
import { getReadableTextColor } from "../team-kit-mark";
import { KIT_COLOR_PALETTE } from "@/lib/teams/kit-color";

/**
 * "Automatic readable number colour" (05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md §4) — a plain
 * relative-luminance contrast decision, not a fixed per-colour lookup, so it works for any future
 * hex, palette or not.
 */
describe("TeamKitMark — getReadableTextColor (shirt contrast)", () => {
  it("chooses light text on dark fills", () => {
    expect(getReadableTextColor("#1c1c1e")).toBe("#f5f5f5"); // BLACK
    expect(getReadableTextColor("#132a52")).toBe("#f5f5f5"); // NAVY
    expect(getReadableTextColor("#d5342c")).toBe("#f5f5f5"); // RED
  });

  it("chooses dark text on light fills", () => {
    expect(getReadableTextColor("#f2f2f2")).toBe("#101014"); // WHITE
    expect(getReadableTextColor("#e8c521")).toBe("#101014"); // YELLOW
  });

  it("returns a readable colour for every palette entry, never returning the fill colour itself", () => {
    for (const swatch of KIT_COLOR_PALETTE) {
      const text = getReadableTextColor(swatch.hex);
      expect(text).not.toBe(swatch.hex);
      expect(["#101014", "#f5f5f5"]).toContain(text);
    }
  });

  it("degrades safely on a malformed hex (falls back to light text rather than throwing)", () => {
    expect(() => getReadableTextColor("not-a-color")).not.toThrow();
    expect(getReadableTextColor("not-a-color")).toBe("#ffffff");
  });
});
