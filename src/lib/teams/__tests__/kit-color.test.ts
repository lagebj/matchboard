import { describe, it, expect } from "vitest";
import { KIT_COLOR_PALETTE, isValidKitColor, resolveKitColorSwatch } from "../kit-color";

describe("kit-color", () => {
  it("accepts every palette id as valid", () => {
    for (const swatch of KIT_COLOR_PALETTE) {
      expect(isValidKitColor(swatch.id)).toBe(true);
    }
  });

  it("rejects an arbitrary string, including a raw hex value", () => {
    expect(isValidKitColor("#ff0000")).toBe(false);
    expect(isValidKitColor("")).toBe(false);
    expect(isValidKitColor("PINK")).toBe(false);
  });

  it("resolves a valid id to its swatch", () => {
    const swatch = resolveKitColorSwatch("RED");
    expect(swatch?.id).toBe("RED");
    expect(swatch?.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("resolves null/undefined/unrecognised values to null (neutral default)", () => {
    expect(resolveKitColorSwatch(null)).toBeNull();
    expect(resolveKitColorSwatch(undefined)).toBeNull();
    expect(resolveKitColorSwatch("SOME_REMOVED_LEGACY_VALUE")).toBeNull();
  });

  it("has a unique id per swatch", () => {
    const ids = KIT_COLOR_PALETTE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
