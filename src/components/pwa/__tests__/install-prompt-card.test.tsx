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
  });

  it("renders nothing when not installed, not iOS, and no install prompt captured", () => {
    mockMatchMedia(() => false);
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120");
    const { container } = render(<InstallPwaCard />);
    expect(container).toBeEmptyDOMElement();
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
});
