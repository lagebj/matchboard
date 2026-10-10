import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import CentralProfileProjectionPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <CentralProfileProjectionPage />
    </ThemeProvider>,
  );
}

describe("A04-S5 central-profile-projection page", () => {
  it("shows the CM projection summary: 30 minutes, 1 distinct match", () => {
    renderPage();
    expect(screen.getByText("CM: 30 recorded minutes, 1 distinct match")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("the drilldown still shows both exact positions and their individual minutes, not rewritten to CM", () => {
    renderPage();
    const rows = screen.getAllByTestId("s5-breakdown-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("LCM")).toBeInTheDocument();
    expect(screen.getByText("RCM")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.getByText("10 min")).toBeInTheDocument();
  });

  it("never claims two matches", () => {
    renderPage();
    expect(screen.queryByText(/2 distinct match/)).not.toBeInTheDocument();
  });
});
