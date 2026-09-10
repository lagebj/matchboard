import { describe, it, expect } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  APPEARANCE_MODES,
  isAppearanceMode,
} from "@/lib/theme/theme";

describe("theme constants", () => {
  it("default appearance is `system`", () => {
    expect(DEFAULT_APPEARANCE).toBe("system");
    expect(APPEARANCE_MODES).toEqual(["system", "light", "dark"]);
  });

  it("isAppearanceMode accepts only the three modes", () => {
    expect(isAppearanceMode("system")).toBe(true);
    expect(isAppearanceMode("light")).toBe(true);
    expect(isAppearanceMode("dark")).toBe(true);
    expect(isAppearanceMode("")).toBe(false);
    expect(isAppearanceMode("Dark")).toBe(false);
    expect(isAppearanceMode(null)).toBe(false);
    expect(isAppearanceMode(undefined)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("is a static string with no interpolation seam", () => {
    // A literal `${` would mean code is being constructed from a value — the
    // exact CodeQL js/bad-code-sanitization concern this script must avoid.
    expect(THEME_INIT_SCRIPT).not.toContain("${");
    expect(THEME_INIT_SCRIPT).not.toContain("`");
  });

  it("references the canonical storage key literally", () => {
    // The script hardcodes the key rather than interpolating THEME_STORAGE_KEY;
    // this keeps the two in sync if the key is ever renamed.
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_STORAGE_KEY).toBe("matchboard-theme");
  });

  it("only ever writes data-theme=light|dark or removes it, and pins color-scheme", () => {
    expect(THEME_INIT_SCRIPT).toContain('setAttribute("data-theme",t)');
    expect(THEME_INIT_SCRIPT).toContain('removeAttribute("data-theme")');
    expect(THEME_INIT_SCRIPT).toContain('t==="light"||t==="dark"');
    expect(THEME_INIT_SCRIPT).toContain("d.style.colorScheme=t");
  });

  it("guards localStorage access and never throws", () => {
    // Both the read and the whole body are wrapped in try/catch.
    expect(THEME_INIT_SCRIPT).toMatch(/try\{t=localStorage\.getItem/);
    expect(THEME_INIT_SCRIPT.startsWith("(function(){try{")).toBe(true);

    // Executing it in a DOM-less context is a no-op, not a crash.
    expect(() => {
      const g = globalThis as Record<string, unknown>;
      const hadDocument = "document" in g;
      new Function(THEME_INIT_SCRIPT)();
      expect("document" in g).toBe(hadDocument);
    }).not.toThrow();
  });

  it("applies a stored explicit theme to a fake <html> before paint", () => {
    const root: {
      attrs: Record<string, string>;
      style: Record<string, string>;
      setAttribute(k: string, v: string): void;
      removeAttribute(k: string): void;
    } = {
      attrs: {},
      style: {},
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      removeAttribute(k) {
        delete this.attrs[k];
      },
    };
    const fakeDoc = { documentElement: root };
    const fakeLocalStorage = { getItem: (_k: string) => "dark" };

    new Function("document", "localStorage", THEME_INIT_SCRIPT)(fakeDoc, fakeLocalStorage);

    expect(root.attrs["data-theme"]).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("removes data-theme when nothing valid is stored", () => {
    const root = {
      attrs: { "data-theme": "dark" } as Record<string, string>,
      style: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        this.attrs[k] = v;
      },
      removeAttribute(k: string) {
        delete this.attrs[k];
      },
    };
    const fakeDoc = { documentElement: root };
    const fakeLocalStorage = { getItem: (_k: string) => "system" };

    new Function("document", "localStorage", THEME_INIT_SCRIPT)(fakeDoc, fakeLocalStorage);

    expect(root.attrs["data-theme"]).toBeUndefined();
  });
});
