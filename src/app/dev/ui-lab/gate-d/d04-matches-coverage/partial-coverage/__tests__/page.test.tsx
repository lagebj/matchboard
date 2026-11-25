import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D04PartialCoveragePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D04PartialCoveragePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D04 partial coverage", () => {
  it("renders full minutes and position for the one fully-recorded match", () => {
    renderPage();
    expect(screen.getByText("90'")).toBeInTheDocument();
    expect(screen.getByText("CB")).toBeInTheDocument();
  });

  it("makes a match with no recorded minutes at all visibly distinct — never a fabricated 0'", () => {
    renderPage();
    expect(screen.queryByText("0'")).not.toBeInTheDocument();
  });

  it("surfaces unrecorded actual position honestly for both the no-minutes and the has-minutes-but-no-position matches, never inferred from a plan", () => {
    renderPage();
    expect(screen.getAllByText("No actual position recorded")).toHaveLength(2);
    // The match with recorded minutes but no position still shows its real minutes.
    expect(screen.getByText("23'")).toBeInTheDocument();
  });

  it("renders all three matches by name regardless of coverage completeness", () => {
    renderPage();
    expect(screen.getByText("Askim IF")).toBeInTheDocument();
    expect(screen.getByText("Mysen IL")).toBeInTheDocument();
    expect(screen.getByText("Trøgstad/Båstad")).toBeInTheDocument();
  });
});
