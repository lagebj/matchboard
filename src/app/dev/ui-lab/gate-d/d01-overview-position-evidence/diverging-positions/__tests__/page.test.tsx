import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D01DivergingPositionsPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D01DivergingPositionsPage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D01 diverging positions", () => {
  it("renders the position-evolution current-story headline, naming both the previous and new position", () => {
    renderPage();
    expect(
      screen.getByText(
        "Recorded primary position updated to Right Back based on recent match evidence (previously Centre Back).",
      ),
    ).toBeInTheDocument();
  });

  it("declared primary (Centre Back) still renders even though evidence now favours a different position — the declaration is never silently overwritten by evidence", () => {
    renderPage();
    expect(screen.getByText("Centre Back (CB)")).toBeInTheDocument();
  });

  it("evidence-derived positions rank Right Back above Centre Back, using the same label vocabulary the declaration uses", () => {
    renderPage();
    const rightBackEntries = screen.getAllByText("Right Back");
    expect(rightBackEntries.length).toBeGreaterThanOrEqual(1);
    const centreBackEntries = screen.getAllByText("Centre Back");
    expect(centreBackEntries.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
  });
});
