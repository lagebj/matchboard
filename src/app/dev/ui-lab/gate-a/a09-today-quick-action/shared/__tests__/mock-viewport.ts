import { afterEach } from "vitest";

/**
 * Shared `useMediaQuery("(min-width: 600px)")` mock (same approach as A04's
 * `shared/__tests__/mock-viewport.ts`), reused across every A09 scenario test file instead of
 * being copy-pasted six times. Registers its own `afterEach` restoration in the calling test
 * file. A09 keeps its own copy rather than importing A04's or A07's — a different concept family
 * should not develop a hidden coupling just because this one small helper happens to match.
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
