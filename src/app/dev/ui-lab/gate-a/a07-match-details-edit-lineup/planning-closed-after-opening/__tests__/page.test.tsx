import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import PlanningClosedAfterOpeningPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <PlanningClosedAfterOpeningPage />
    </ThemeProvider>,
  );
}

describe("A07-S5 planning-closed-after-opening page", () => {
  it("the editor still opens and the candidate is still selectable even though planning is closed", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
  });

  it("Confirm resolves to a PLANNING_CLOSED refusal with no fake Force save control anywhere", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    expect(screen.getByText("Planning is closed for this match")).toBeInTheDocument();
    expect(screen.queryByText(/force save/i)).not.toBeInTheDocument();
  });

  it("the pitch still shows RCM empty after the refusal — no save occurred", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).queryByText("Tobias")).not.toBeInTheDocument();
  });
});
