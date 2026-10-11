import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import MatchDayAdditionPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <MatchDayAdditionPage />
    </ThemeProvider>,
  );
}

describe("A09-S6 match-day-addition page", () => {
  it("raises the operational roster count on SUCCESS while the separate planned-squad line stays untouched throughout", () => {
    mockViewport(true);
    renderPage();

    const plannedLine = screen.getByTestId("a09-s6-planned-squad-line");
    expect(plannedLine).toHaveTextContent("Planned squad: 8/9 (unchanged by this action)");

    fireEvent.click(screen.getByRole("button", { name: "Add match-day helper" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/Operational roster: 8/);
    expect(plannedLine).toHaveTextContent("Planned squad: 8/9 (unchanged by this action)"); // still untouched

    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add match-day helper" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));

    expect(within(dialog).getByText("Saved (simulated)")).toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/Operational roster: 9/);
    // The planned-selection line is a completely separate text node, unchanged by the operational SUCCESS.
    expect(plannedLine).toHaveTextContent("Planned squad: 8/9 (unchanged by this action)");
  });

  it("the operational-roster count has no fixed target (no '/N' suffix)", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add match-day helper" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("today-count").textContent).not.toMatch(/\//);
  });
});
