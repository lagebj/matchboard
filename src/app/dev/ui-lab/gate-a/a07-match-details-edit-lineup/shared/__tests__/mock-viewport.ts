import { afterEach } from "vitest";

/**
 * Same `useMediaQuery("(min-width: 600px)")` mock approach as A01/A04 — reused across every A07
 * scenario test file. A07 keeps its own copy rather than importing A04's/A09's — a different
 * concept family should not develop a hidden coupling just because this one small helper matches.
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
