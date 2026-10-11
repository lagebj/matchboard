import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import A10ReviewAlternativeSuccessPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <A10ReviewAlternativeSuccessPage />
    </ThemeProvider>,
  );
}

function openAndSelect() {
  fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
  fireEvent.click(screen.getByTestId("lineup-proposal-row"));
}

describe("A10-review-alternative-success page", () => {
  it("opens exactly one inline inspector on desktop, aria-modal false", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "false");
  });

  it("shows the proposal's evidence count, rationale, and limitations before any selection", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.getByTestId("proposal-evidence-count").textContent).toMatch(/2 cited sources/);
    expect(screen.getByText(/declared central-midfield position/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation: No completed-match minutes recorded/)).toBeInTheDocument();
  });

  it("shows the diff preview and expected-consequence disclaimer once selected", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const preview = screen.getByTestId("lineup-diff-preview");
    expect(preview.textContent).toMatch(/RCM:/);
    expect(preview.textContent).toMatch(/Tobias/);
    expect(preview.textContent).toMatch(/not yet applied/i);
    expect(preview.textContent).toMatch(/advisory only, not a guaranteed outcome/);
  });

  it("Apply proposal enters PENDING, then resolving applies SUCCESS and the pitch reflects Tobias at RCM exactly once", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
    expect(screen.getByText("Applying… (fixture simulation)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    expect(screen.getByText("Saved (simulated)")).toBeInTheDocument();

    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).getByText("Tobias")).toBeInTheDocument();
  });

  it("never renders a navigation link inside the dialog — context-local only", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
  });

  it("closes on Escape and restores focus to the Review lineup trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: "Review lineup" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
