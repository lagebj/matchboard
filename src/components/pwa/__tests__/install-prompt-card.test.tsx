import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InstallPwaCard } from "../install-prompt-card";

function mockMatchMedia(matchesFor: (query: string) => boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matchesFor(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const DEFAULT_UA = window.navigator.userAgent;

describe("InstallPwaCard (UX-2.10-01)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setUserAgent(DEFAULT_UA);
    window.localStorage.clear();
  });

  it("shows generic browser-menu instructions when not installed, not iOS, and no install prompt captured", () => {
    mockMatchMedia(() => false);
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
    render(<InstallPwaCard />);
    expect(screen.getByText(/install app.*add to home screen/i)).toBeTruthy();
  });

  it("shows the installed state when running in standalone display mode", () => {
    mockMatchMedia((query) => query === "(display-mode: standalone)");
    render(<InstallPwaCard />);
    expect(screen.getByText("Matchboard is installed")).toBeTruthy();
  });

  it("shows iOS Home Screen instructions on iOS when not installed", () => {
    mockMatchMedia(() => false);
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    render(<InstallPwaCard />);
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });

  it("shows an Install button after beforeinstallprompt fires, and calls prompt() on click", async () => {
    mockMatchMedia(() => false);
    setUserAgent("Mozilla/5.0 (Linux; Android 13) Chrome/120");
    render(<InstallPwaCard />);

    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: "accepted" as const });
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice,
    });
    fireEvent(window, event);

    const installBtn = await screen.findByRole("button", { name: "Install" });
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(screen.getByText("Matchboard is installed")).toBeTruthy();
    });
  });

  it("shows the installed state after the appinstalled event fires", () => {
    mockMatchMedia(() => false);
    setUserAgent("Mozilla/5.0 (Linux; Android 13) Chrome/120");
    render(<InstallPwaCard />);

    fireEvent(window, new Event("appinstalled"));
    expect(screen.getByText("Matchboard is installed")).toBeTruthy();
  });

  describe("dismissible mode (first-visit banner)", () => {
    it("shows a dismiss control and hides itself after dismissal, remembered across remounts", () => {
      mockMatchMedia(() => false);
      setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
      const { unmount } = render(<InstallPwaCard dismissible />);

      expect(screen.getByText(/install app.*add to home screen/i)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss install prompt" }));
      expect(screen.queryByText(/install app.*add to home screen/i)).toBeNull();

      unmount();
      const { container } = render(<InstallPwaCard dismissible />);
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing (not a confirmation) when already installed in dismissible mode", () => {
      mockMatchMedia((query) => query === "(display-mode: standalone)");
      const { container } = render(<InstallPwaCard dismissible />);
      expect(container).toBeEmptyDOMElement();
    });

    it("does not affect a separate non-dismissible instance", () => {
      mockMatchMedia(() => false);
      setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
      render(<InstallPwaCard dismissible />);
      fireEvent.click(screen.getByRole("button", { name: "Dismiss install prompt" }));

      render(<InstallPwaCard />);
      expect(screen.getAllByText(/install app.*add to home screen/i).length).toBeGreaterThan(0);
    });
  });
});
