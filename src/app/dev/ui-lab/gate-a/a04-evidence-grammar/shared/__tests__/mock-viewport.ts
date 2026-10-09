import { afterEach } from "vitest";

/**
 * Shared `useMediaQuery("(min-width: 600px)")` mock (same approach as A01's
 * `a01-fixture.test.tsx`), reused across every A04 scenario test file instead of being
 * copy-pasted six times. Registers its own `afterEach` restoration in the calling test file.
 */
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
