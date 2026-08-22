"use client";

import { useEffect, useState } from "react";

/**
 * useMediaQuery — subscribes to a CSS media query for device-adaptive
 * component choice (e.g. Dialog on desktop vs. BottomSheet on phone). This is
 * a legitimate JS use case distinct from the pure-CSS viewport-tier work in
 * `globals.css`'s `@theme` breakpoints — here the *component itself* differs
 * per tier, which CSS alone cannot express.
 *
 * SSR-safe: returns `false` until mounted, then syncs to the real value.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
