import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D06CoherentPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D06CoherentPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D06 coherent cross-source synthesis", () => {
  it("renders the hypothesis and all three cited source kinds", () => {
    renderPage();
    expect(screen.getByText(/Noah Fjeld's on-pitch exposure has shifted/)).toBeInTheDocument();
    // Each label appears twice: once in the panel's own plain-text "Supporting evidence:" line,
    // once as the source inspector's <summary> — both real, not a duplicate rendering bug.
    expect(screen.getAllByText("Centre-back role minutes, previous 3 vs. latest 3 matches").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Recorded position, 30 Aug 2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Recorded position, 11 Oct 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("distinguishes recorded facts from derived measurements in the source inspector", () => {
    renderPage();
    expect(screen.getAllByText("Recorded fact")).toHaveLength(3);
    expect(screen.getAllByText("Derived measurement")).toHaveLength(1);
  });

  it("discloses that the source inspector is a UI Lab directional presentation, not production", () => {
    renderPage();
    expect(screen.getByText(/not a production capability/)).toBeInTheDocument();
  });
});
