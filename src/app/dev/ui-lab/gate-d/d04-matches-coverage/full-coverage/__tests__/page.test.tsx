import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D04FullCoveragePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D04FullCoveragePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D04 full coverage", () => {
  it("renders minutes and actual positions for every match, never a missing-data placeholder", () => {
    renderPage();
    expect(screen.getByText("Askim IF")).toBeInTheDocument();
    expect(screen.getByText("Mysen IL")).toBeInTheDocument();
    expect(screen.getByText("Internal training match")).toBeInTheDocument();
    expect(screen.getAllByText("90'")).toHaveLength(2);
    expect(screen.getByText("45'")).toBeInTheDocument();
    expect(screen.queryByText("No actual position recorded")).not.toBeInTheDocument();
  });

  it("joins multiple actual positions in played order rather than collapsing to one", () => {
    renderPage();
    expect(screen.getByText("RCB → CB")).toBeInTheDocument();
  });
});
