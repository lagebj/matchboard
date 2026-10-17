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
  it("shows honest missing-planning state, not an invented checklist or percentage", () => {
    renderPage();
    expect(screen.getByText("Select the remaining squad and set a lineup")).toBeInTheDocument();
    expect(screen.getByText("Lineup not set — no positions have been assigned yet.")).toBeInTheDocument();
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
    expect(screen.getByText("Select the remaining squad and set a lineup")).toBeInTheDocument();
  });
});
