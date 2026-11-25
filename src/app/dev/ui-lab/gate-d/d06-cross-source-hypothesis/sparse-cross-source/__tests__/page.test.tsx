import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D06SparsePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D06SparsePage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D06 sparse cross-source evidence", () => {
  it("renders the honest no-hypothesis state", () => {
    renderPage();
    expect(screen.getByText("No defensible hypothesis")).toBeInTheDocument();
  });

  it("keeps the different kinds of gap distinguishable, not collapsed into one vague line", () => {
    renderPage();
    expect(screen.getByText(/Missing data: no actual position interval/)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient sample: only 2 of 6 eligible matches/)).toBeInTheDocument();
    expect(screen.getByText(/No contrary evidence: nothing on record/)).toBeInTheDocument();
    expect(screen.getByText(/Coach uncertainty, recorded directly/)).toBeInTheDocument();
  });

  it("never forces a complete cross-source narrative out of insufficient evidence", () => {
    renderPage();
    expect(screen.queryByText("Assistant Coach hypotheses")).not.toBeInTheDocument();
  });
});
