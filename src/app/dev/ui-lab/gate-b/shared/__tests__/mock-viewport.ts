import { afterEach } from "vitest";

/**
 * Same `useMediaQuery("(min-width: 600px)")` mock approach Gate A's A07 established — Gate B
 * keeps its own copy rather than importing A07's, per that file's own "different concept family"
 * precedent.
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
