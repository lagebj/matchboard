import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia. Components using useMediaQuery
// (src/lib/hooks/use-media-query.ts) need this to render at all in tests —
// defaults to "no match" (desktop-first) unless a test overrides it.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom does not implement scrollIntoView. Components that auto-scroll a focused/selected item
// into view (e.g. TeamConfigurationPage's "jump to squad settings") call this on mount/update —
// provide a no-op so those components can render in tests without crashing.
if (typeof window.HTMLElement.prototype.scrollIntoView !== "function") {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}