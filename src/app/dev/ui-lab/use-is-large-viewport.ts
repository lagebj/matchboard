"use client";

import { useEffect, useState } from "react";

/**
 * Matches the `large` Touchline breakpoint (1200px, `globals.css` `@theme`).
 * Desktop Lineup/Tactics show a `TouchlineInspector` at this width instead of
 * the compact selected-player bottom sheet (`06_TACTICS_LINEUP_AND_PITCH.md
 * §7`) — dev-only UI Lab helper, not a production hook.
 */
export function useIsLargeViewport(): boolean {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1200px)");
    setIsLarge(query.matches);
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isLarge;
}
