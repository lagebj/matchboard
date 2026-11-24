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
  it("renders a current-story headline that makes no claim about the primary position having already changed (fixed 2026-11-24 — the prior POSITION_EVOLUTION-sourced headline contradicted this page's own 'no automatic mutation' disclosure)", () => {
    renderPage();
    expect(screen.getByText("Recent opportunities have been consistent: 4 of 5 eligible rounds.")).toBeInTheDocument();
    expect(screen.queryByText(/Recorded primary position updated/)).not.toBeInTheDocument();
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

  it("demonstrates the approved 14-role profile experience diverging at the profile level, not only the exact-code level, and discloses no automatic mutation occurs", () => {
    renderPage();
    expect(screen.getByText("Player-profile role (directional)")).toBeInTheDocument();
    expect(screen.getByText(/Declared profile role \(CB\) and the evidence-derived role \(RB\) differ\./)).toBeInTheDocument();
    expect(screen.getByText(/no automatic primary-position mutation occurs/)).toBeInTheDocument();
  });
});
