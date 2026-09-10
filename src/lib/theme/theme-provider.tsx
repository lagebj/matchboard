"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  readStoredAppearance,
  type AppearanceMode,
} from "@/lib/theme/theme";

type ResolvedAppearance = "light" | "dark";

type ThemeContextValue = {
  /** The user's stored preference. */
  mode: AppearanceMode;
  /** What is actually showing right now (system resolved against the OS). */
  resolved: ResolvedAppearance;
  setMode: (mode: AppearanceMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemResolved(): ResolvedAppearance {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>(DEFAULT_APPEARANCE);
  const [systemPref, setSystemPref] = useState<ResolvedAppearance>("dark");

  // Hydrate from storage once mounted (the inline script already painted <html>).
  useEffect(() => {
    setModeState(readStoredAppearance());
    setSystemPref(systemResolved());
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemPref(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    applyAppearance(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved: mode === "system" ? systemPref : mode,
      setMode,
    }),
    [mode, systemPref, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
