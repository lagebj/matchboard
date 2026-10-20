import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B02PlannedIncompletePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B02PlannedIncompletePage />
    </ThemeProvider>,
  );
}

describe("B02 planned-incomplete page", () => {
  it("shows honest missing-planning state via the real MatchPreparationWidget, not an invented checklist, percentage, or duplicate banner", () => {
    renderPage();
    // Design-audit correction: an earlier revision added a DecisionBanner restating this same
    // "5/8 selected, lineup not set" state in different words — removed as duplicate information.
    expect(screen.getByText("1/3 complete")).toBeInTheDocument();
    expect(screen.getByText("5/8")).toBeInTheDocument();
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.getByText("Lineup not set — no positions have been assigned yet.")).toBeInTheDocument();
    expect(screen.queryByText("Select the remaining squad and set a lineup")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it("renders no Opponent memory widget — honestly absent, not a disabled placeholder", () => {
    renderPage();
    expect(screen.queryByText("Opponent memory")).not.toBeInTheDocument();
  });

  it("Match Insights shows its own real empty state", () => {
    renderPage();
    expect(screen.getByText("No major exceptions in the current plan.")).toBeInTheDocument();
  });

  it("is meaningfully different from a permission-denied or data-error state — no such banner renders", () => {
    renderPage();
    expect(screen.queryByText("Permission denied")).not.toBeInTheDocument();
    expect(screen.queryByText("Could not save")).not.toBeInTheDocument();
    expect(screen.getByText("Not yet")).toBeInTheDocument();
  });
});
