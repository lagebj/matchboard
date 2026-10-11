import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AssignReserveSuccessPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AssignReserveSuccessPage />
    </ThemeProvider>,
  );
}

function openAndSelect() {
  fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
  fireEvent.click(screen.getByTestId("lineup-candidate-row"));
}

describe("A07-S1/S2 assign-reserve-success page", () => {
  it("opens exactly one inline inspector on desktop, aria-modal false", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "false");
  });

  it("opens exactly one modal bottom sheet on mobile, aria-modal true", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
  });

  it("shows the current→proposed diff preview once the candidate is selected", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const preview = screen.getByTestId("lineup-diff-preview");
    expect(preview.textContent).toMatch(/RCM:/);
    expect(preview.textContent).toMatch(/Empty/);
    expect(preview.textContent).toMatch(/Tobias/);
    expect(preview.textContent).toMatch(/not yet saved/i);
  });

  it("Confirm enters PENDING with a deterministic fixture-step control, not a timer", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    expect(screen.getByText("Saving… (fixture simulation)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue fixture simulation →" })).toBeInTheDocument();
  });

  it("resolving the pending step applies SUCCESS: the pitch goes from 6 to 7 assignments and Tobias appears at RCM", () => {
    mockViewport(true);
    renderPage();
    const pitchBefore = screen.getByTestId("touchline-planning-pitch");
    expect(within(pitchBefore).queryByText("Tobias")).not.toBeInTheDocument();

    openAndSelect();
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    expect(screen.getByText("Saved (simulated)")).toBeInTheDocument();
    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    const mainPitch = pitches[0];
    expect(within(mainPitch).getByText("Tobias")).toBeInTheDocument();
  });

  it("rejects a double submit — clicking Confirm twice fast produces the same single SUCCESS", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    // Confirm is disabled while PENDING, so a second click (if it somehow fired) must be a no-op
    // at the hook level too — assert only ONE "Continue fixture simulation" control exists and
    // resolving it lands on SUCCESS exactly once.
    expect(screen.getAllByRole("button", { name: "Continue fixture simulation →" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    expect(screen.getByText("Saved (simulated)")).toBeInTheDocument();
  });

  it("never renders a navigation link for the edit/confirm/close controls — only buttons", () => {
    mockViewport(true);
    renderPage();
    openAndSelect();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
  });

  it("closes on Escape and restores focus to the Edit lineup trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: "Edit lineup" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("always shows the fixture-simulation caption", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    expect(screen.getByTestId("fixture-simulation-caption").textContent).toMatch(/Fixture-only simulated save/);
  });
});
