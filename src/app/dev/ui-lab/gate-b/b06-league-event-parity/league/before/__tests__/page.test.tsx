import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06LeagueBeforePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B06LeagueBeforePage />
    </ThemeProvider>,
  );
}

describe("B06 League · Before page", () => {
  it("shows the real League team identity with its real kit colour", () => {
    renderPage();
    expect(screen.getAllByText(/Slemmestad Rød/).length).toBeGreaterThan(0);
    // "Hvalstad IL" appears both in MatchIdentityCard's own team label and in this page's
    // explanatory footnote sentence — a genuine, deliberate duplication, not a bug to query
    // around with getByText's single-match assumption.
    expect(screen.getAllByText(/Hvalstad IL/).length).toBeGreaterThan(1);
  });

  it("renders the comparison nav with League · Before active", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Compare lifecycle stage" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "League · Before" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Event · Before" })).not.toHaveAttribute("aria-current");
  });

  it("describes the shared live-reporting primary action without a fake interactive button", () => {
    renderPage();
    expect(screen.getByText(/Start live reporting/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start live reporting/ })).not.toBeInTheDocument();
  });
});
