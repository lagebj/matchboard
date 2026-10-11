import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AddPlayerPlanningClosedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AddPlayerPlanningClosedPage />
    </ThemeProvider>,
  );
}

describe("A09-S4 add-player-planning-closed page", () => {
  it("allows a genuine draft/preview, then rejects at Confirm with PLANNING_CLOSED, leaving the planned-squad count unchanged", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");

    const row = within(dialog).getByTestId("today-candidate-row");
    expect(row).not.toBeDisabled();
    fireEvent.click(row);
    expect(within(dialog).getByTestId("today-diff-preview")).toBeInTheDocument(); // genuine preview, not blocked at entry

    fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));

    expect(within(dialog).getByText("Planning is closed for this match")).toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/); // unchanged
    expect(within(dialog).getByTestId("today-diff-preview")).toBeInTheDocument(); // draft preserved for inspection
  });
});
