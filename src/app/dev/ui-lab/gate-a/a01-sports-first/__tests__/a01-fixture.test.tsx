import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A01SportsFirstPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A01SportsFirstPage />
    </ThemeProvider>,
  );
}

/**
 * `useMediaQuery` reads `window.matchMedia("(min-width: 600px)")`. The shared test setup
 * polyfills `matchMedia` to always report `matches: false` (desktop-first default, see
 * `src/test/setup-component.ts`) — these tests only need to override that one query, leaving any
 * other query (e.g. the theme provider's `prefers-color-scheme` check) on the default polyfill.
 */
let restoreMatchMedia: (() => void) | undefined;

function mockViewport(isDesktop: boolean) {
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
  restoreMatchMedia = () => {
    window.matchMedia = original;
  };
}

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

/**
 * A01 context-local interaction invariant (PR #777 remediation, XR-I01): the "Lineup" quick
 * action must stay on this page — it must never read as a navigation to a different route or
 * demonstration.
 */
describe("A01 sports-first candidate — context-local Lineup action", () => {
  it("renders Lineup as a button, not a link to another page", () => {
    renderPage();
    const lineupControl = screen.getByText("Lineup").closest("button, a");
    expect(lineupControl?.tagName).toBe("BUTTON");
  });

  it("opens an in-page lineup preview without unmounting the page's own content", () => {
    renderPage();
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Lineup"));

    expect(screen.getByTestId("lineup-preview-list")).toBeInTheDocument();
    // The page heading is still present — we did not navigate away.
    expect(screen.getByText("A01 — Sports-first composition")).toBeInTheDocument();
    // Read-only preview, not an editor: no save/submit control anywhere in the sheet.
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("the lineup preview lists real squad members, not placeholder rows", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    expect(screen.getByText("Kristian")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("closes back to the same page via the sheet's close control", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();
  });

  it("closes on Escape (keyboard access)", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    expect(screen.getByTestId("lineup-preview-list")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();
  });

  it("restores focus to the Lineup trigger after closing (focus restoration)", () => {
    renderPage();
    const trigger = screen.getByText("Lineup").closest("button")!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(document.activeElement).toBe(trigger);
  });
});

/**
 * PR #777 final A01 correction: desktop must get a contextual inspector beside the match, mobile
 * must keep the focused bottom sheet — never both at once, and never diverging content.
 */
describe("A01 — responsive Lineup presentation (PR #777 final correction)", () => {
  it("desktop (>=600px): opens the contextual inspector, not the bottom sheet", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));

    expect(screen.getByRole("dialog", { name: "Lineup inspector" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1); // never both presentations at once
    // The sheet's own description copy never renders on desktop.
    expect(screen.queryByText(/context-local preview, stays on this page/)).not.toBeInTheDocument();
  });

  it("mobile (<600px): opens the bottom sheet, not the contextual inspector", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));

    expect(screen.queryByRole("dialog", { name: "Lineup inspector" })).not.toBeInTheDocument();
    expect(screen.getByText(/context-local preview, stays on this page/)).toBeInTheDocument();
  });

  it("never renders both presentations at once, at either viewport (no duplicate accessible controls)", () => {
    for (const isDesktop of [true, false]) {
      mockViewport(isDesktop);
      const { unmount } = renderPage();
      fireEvent.click(screen.getByText("Lineup"));

      expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
      expect(screen.getAllByTestId("lineup-preview-list")).toHaveLength(1);
      unmount();
    }
  });

  it("desktop and mobile show identical lineup data — one shared fixture, not two", () => {
    for (const isDesktop of [true, false]) {
      mockViewport(isDesktop);
      const { unmount } = renderPage();
      fireEvent.click(screen.getByText("Lineup"));

      // Same fixture rows, same order, in whichever presentation this viewport rendered.
      const rows = screen.getByTestId("lineup-preview-list").querySelectorAll("li");
      expect(rows).toHaveLength(11);
      expect(screen.getByText("Kristian")).toBeInTheDocument();
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("Theo")).toBeInTheDocument();
      expect(screen.getByText("#7")).toBeInTheDocument();
      unmount();
    }
  });

  it("the match workspace stays mounted behind the inspector on desktop (no navigation, no unmount)", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    expect(screen.getByText("A01 — Sports-first composition")).toBeInTheDocument();
    // "2 : 1" is the hero OperationalMatchCard's live score — unique to it, proves it's still mounted.
    expect(screen.getByText("2 : 1")).toBeInTheDocument();
  });

  it("desktop inspector closes on Escape and restores focus to the trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByText("Lineup").closest("button")!;
    trigger.focus();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Lineup inspector" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Lineup inspector" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("desktop inspector closes via its own Close control", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Lineup inspector" })).not.toBeInTheDocument();
  });

  it("closing the desktop inspector returns to a single-column layout (no empty inspector column left behind)", () => {
    mockViewport(true);
    const { container } = renderPage();
    const rootBefore = container.firstElementChild as HTMLElement;
    expect(rootBefore.className).toContain("max-w-[480px]");

    fireEvent.click(screen.getByText("Lineup"));
    expect((container.firstElementChild as HTMLElement).className).toContain("max-w-[920px]");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect((container.firstElementChild as HTMLElement).className).toContain("max-w-[480px]");
  });
});
