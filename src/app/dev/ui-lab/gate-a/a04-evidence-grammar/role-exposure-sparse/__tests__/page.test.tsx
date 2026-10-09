import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import RoleExposureSparsePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <RoleExposureSparsePage />
    </ThemeProvider>,
  );
}

/**
 * A04-S2 forbids any trend inference (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`: "No DerivedTrend,
 * smoothed sparkline, growth arrow, improvement claim, or automatically inferred suitability
 * change").
 */
describe("A04-S2 role-exposure-sparse page", () => {
  it("shows 2 of 6 eligible matches with recorded exposure", () => {
    renderPage();
    expect(screen.getByText("2 of 6 eligible matches with recorded exposure")).toBeInTheDocument();
  });

  it("shows exactly the two recorded observations as discrete rows, not a continuous series", () => {
    renderPage();
    expect(screen.getAllByTestId("s2-observed-row")).toHaveLength(2);
    expect(screen.getByText("Match 2")).toBeInTheDocument();
    expect(screen.getByText("18 min")).toBeInTheDocument();
    expect(screen.getByText("Match 5")).toBeInTheDocument();
    expect(screen.getByText("24 min")).toBeInTheDocument();
  });

  it("never renders a trend, sparkline, growth-arrow, or improvement claim", () => {
    renderPage();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/trend|improv(ed|ing|ement)|growth|growing|increasing suitability/i);
    expect(screen.queryByTestId(/trend|sparkline/)).not.toBeInTheDocument();
  });

  it("gives an honest insufficient-coverage answer, not a confident one", () => {
    renderPage();
    expect(screen.getByText("Not enough recorded matches to answer this question yet.")).toBeInTheDocument();
  });
});
