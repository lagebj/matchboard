/**
 * Appearance-mode contract (ADR-0134 §3, bundle `03_BRAND_THEME_AND_TOKENS.md`).
 *
 * `system` (default) omits `data-theme` on <html> and follows
 * `prefers-color-scheme`. `light` / `dark` stamp `data-theme` and pin
 * `color-scheme`. The choice persists in `localStorage` under
 * `matchboard-theme`. `next-themes` is deliberately not used — the behaviour is
 * small enough to own locally.
 */

export type AppearanceMode = "system" | "light" | "dark";

export const APPEARANCE_MODES: readonly AppearanceMode[] = ["system", "light", "dark"] as const;

export const THEME_STORAGE_KEY = "matchboard-theme";

export const DEFAULT_APPEARANCE: AppearanceMode = "system";

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Minimal, self-contained pre-hydration initializer. Injected verbatim into an
 * inline `<script>` in the root layout so an explicit stored theme is applied to
 * `<html>` before first paint — no flash through the wrong appearance. Reads
 * nothing it did not write; tolerates `localStorage` being unavailable.
 *
 * This is a **fully static string literal** — nothing is interpolated into it,
 * so no executable code is ever constructed from a value (CodeQL
 * `js/bad-code-sanitization`). The storage key is written out literally here and
 * must stay equal to `THEME_STORAGE_KEY`; `theme.test.ts` asserts that.
 */
export const THEME_INIT_SCRIPT =
  '(function(){try{var t=null;try{t=localStorage.getItem("matchboard-theme")}catch(e){}' +
  'var d=document.documentElement;if(t==="light"||t==="dark"){d.setAttribute("data-theme",t);' +
  'd.style.colorScheme=t}else{d.removeAttribute("data-theme")}}catch(e){}})();';

/** Apply a mode to <html> and persist it. Client-only. */
export function applyAppearance(mode: AppearanceMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "";
  } else {
    root.setAttribute("data-theme", mode);
    root.style.colorScheme = mode;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — the in-memory choice still applies for this session */
  }
}

/** Read the persisted mode. Returns `system` when nothing valid is stored. */
export function readStoredAppearance(): AppearanceMode {
  if (typeof localStorage === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isAppearanceMode(raw) ? raw : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
