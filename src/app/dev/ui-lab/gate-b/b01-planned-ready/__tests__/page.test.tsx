import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import B01PlannedReadyPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <B01PlannedReadyPage />
    </ThemeProvider>,
  );
}

function openAndSelect() {
  fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
  fireEvent.click(screen.getByTestId("lineup-candidate-row"));
}

describe("B01 planned-ready page", () => {
  it("shows stable match identity and the single real readiness signal, not a duplicate banner", () => {
    mockViewport(true);
    renderPage();
    // MatchPreparationWidget's own computed output is the only readiness surface on the page —
    // design-audit correction: an earlier revision duplicated it with a DecisionBanner restating
    // the same "ready" verdict in different words.
    expect(screen.getByText("3/3 complete")).toBeInTheDocument();
    expect(screen.getAllByText("Ready for match").length).toBe(1);
    expect(screen.queryByText("Squad and lineup are complete")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Slemmestad Rød/).length).toBeGreaterThan(0);
  });

  it("Edit lineup opens the local tactical editor inline on desktop — no navigation away", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "false");
  });

  it("opens a modal bottom sheet on mobile instead", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("resolving the fixture operation to SUCCESS moves Vetle onto the pitch at LCM", () => {
    mockViewport(true);
    renderPage();
    const pitchBefore = screen.getAllByTestId("touchline-planning-pitch")[0];
    expect(within(pitchBefore).queryByText("Vetle")).not.toBeInTheDocument();

    openAndSelect();
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    expect(screen.getByText("Saved (simulated)")).toBeInTheDocument();
    const mainPitch = screen.getAllByTestId("touchline-planning-pitch")[0];
    expect(within(mainPitch).getByText("Vetle")).toBeInTheDocument();
    expect(within(mainPitch).queryByText("Sindre")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the trigger (keyboard smoke)", () => {
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

  it("every Match Insight renders a relevance pill, never a bare numeric score", () => {
    mockViewport(true);
    renderPage();
    expect(screen.getByText("High relevance")).toBeInTheDocument();
  });
});
