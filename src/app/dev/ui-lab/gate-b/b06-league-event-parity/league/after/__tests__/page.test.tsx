import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06LeagueAfterPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B06LeagueAfterPage />
    </ThemeProvider>,
  );
}

describe("B06 League · After page", () => {
  it("shows the final score and the same match identity as League · Before", () => {
    renderPage();
    expect(screen.getByText("3 - 1")).toBeInTheDocument();
    expect(screen.getAllByText(/Slemmestad Rød/).length).toBeGreaterThan(0);
  });

  it("links 'Continue report' to the real B05 completed candidate, not an inert button", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /Continue report/ });
    expect(link).toHaveAttribute("href", "/dev/ui-lab/gate-b/b05-post-match-report/completed");
  });

  it("states the match-scoped return destination explicitly", () => {
    renderPage();
    expect(screen.getByText(/always resolves to this same match-scoped route/)).toBeInTheDocument();
  });
});
