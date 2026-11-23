import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// `assistant-coach-actions.ts` is a real "use server" Server Action module (required — Next's
// compiler needs the actual function reference imported directly by any client component that
// calls it, e.g. `AssistantCoachHypothesisPanel`). Its own transitive dependency chain resolves
// to `next-auth/lib/env.js`'s `import "next/server"` (extensionless), which Next's real bundler
// resolves fine but Vitest's plain Node ESM resolver under jsdom cannot ("Cannot find module
// .../next/server"). This previously only affected the one test that rendered the panel directly
// (which already mocked it locally); `TodaySurface`'s Gate C W3 Assistant Coach seam
// (`today-assistant-coach-panel.tsx`) now imports the same chain unconditionally at module scope,
// so every Today-rendering component test needs the same stub, not just that one file. A test
// file's own `vi.mock` for this path (if it needs to assert call args) overrides this default.
vi.mock("@/app/(app)/o/[orgSlug]/players/[playerId]/assistant-coach-actions", () => ({
  confirmAssistantCoachHypothesisAction: vi.fn(),
  dismissAssistantCoachHypothesisAction: vi.fn(),
}));

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