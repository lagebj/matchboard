import { afterEach } from "vitest";

/** Same `useMediaQuery("(min-width: 600px)")` mock approach as A07/A09 — a deliberate own copy
 * per scenario family, not a shared import (see A07's own doc comment for why). */
export function installViewportMock() {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  return function mockViewport(isDesktop: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      if (query === "(min-width: 600px)") {
        return {
          matches: isDesktop,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList;
      }
      return original(query);
    }) as typeof window.matchMedia;
    restore = () => {
      window.matchMedia = original;
    };
  };
}
